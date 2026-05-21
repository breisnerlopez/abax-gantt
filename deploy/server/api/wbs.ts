import { authenticate, assertCanManageNode, AuthContext } from "./_shared/auth.ts";
import { getClient } from "./_shared/db.ts";
import { ApiError, handleCors, handleError, okResponse } from "./_shared/errors.ts";
import {
  optionalColor,
  optionalDate,
  optionalNumber,
  optionalString,
  optionalUuid,
  parseNodeType,
  readJson,
  requireString,
  requireUuid,
} from "./_shared/validation.ts";

type WbsNode = Record<string, unknown> & {
  id: string;
  project_id: string;
  path: string;
  type: string;
  progress: number;
  end_date: string | null;
  start_date: string | null;
};

function nodeStatus(node: WbsNode): string {
  if (node.status && typeof node.status === "string") return node.status;
  const today = new Date().toISOString().slice(0, 10);
  if (node.progress >= 1) return "completado";
  if (node.end_date && node.end_date < today) return "retrasado";
  if (node.progress > 0) return "en_progreso";
  return "pendiente";
}

function includeAncestors(allNodes: WbsNode[], matches: WbsNode[]): WbsNode[] {
  const keep = new Set<string>();
  for (const match of matches) {
    for (const node of allNodes) {
      if (match.path === node.path || match.path.startsWith(`${node.path}.`)) {
        keep.add(node.id);
      }
    }
  }
  return allNodes.filter((n) => keep.has(n.id));
}

async function visibleProjectIds(
  db: ReturnType<typeof getClient>,
  auth: AuthContext,
  projects: { id: string; created_by: string; project_type_id: string | null }[],
): Promise<Set<string>> {
  if (auth.isAdmin) return new Set(projects.map((p) => p.id));

  const visible = new Set(projects.filter((p) => p.created_by === auth.userId).map((p) => p.id));

  const assignResult = await db.query<{ task_id: string; project_id: string }>(
    `SELECT ta.task_id, wn.project_id
     FROM task_assignees ta
     JOIN wbs_nodes wn ON wn.id = ta.task_id
     WHERE ta.user_id = $1`,
    [auth.userId],
  );
  for (const row of assignResult.rows) visible.add(row.project_id);

  // V-09 fix: si el usuario es responsable de cualquier nodo de un proyecto, lo ve.
  // Antes sólo se evaluaba can_manage_project (responsable del root), excluyendo a quien
  // delega responsabilidad sobre etapas/grupos/tareas sin ser dueño del proyecto raíz.
  const responsibleResult = await db.query<{ project_id: string }>(
    `SELECT DISTINCT project_id FROM wbs_nodes WHERE responsible_id = $1`,
    [auth.userId],
  );
  for (const row of responsibleResult.rows) visible.add(row.project_id);

  for (const p of projects) {
    if (visible.has(p.id)) continue;
    const r = await db.query<{ can_manage: boolean }>(
      `SELECT can_manage_project($1, $2) AS can_manage`,
      [auth.userId, p.id],
    );
    if (r.rows[0]?.can_manage) visible.add(p.id);
  }

  return visible;
}

export async function handler(req: Request): Promise<Response> {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const auth = await authenticate(req);
    const db = getClient();
    const url = new URL(req.url);

    // ── GET ──
    if (req.method === "GET") {
      const projectId = url.searchParams.get("project_id");
      const unscheduled = url.searchParams.get("unscheduled");
      const includeContext = url.searchParams.get("include_context") === "true";
      const myTasks = url.searchParams.get("my_tasks") === "true";
      const projectTypeId = url.searchParams.get("project_type_id");
      const responsibleId = url.searchParams.get("responsible_id");
      const assigneeId = url.searchParams.get("assignee_id");
      const status = url.searchParams.get("status");
      const dateFrom = url.searchParams.get("date_from");
      const dateTo = url.searchParams.get("date_to");
      const search = url.searchParams.get("search")?.trim();

      if (status && !["pendiente", "en_progreso", "completado", "retrasado"].includes(status)) {
        throw new ApiError(400, "status no soportado");
      }

      const projectsResult = await db.query<{
        id: string;
        created_by: string;
        project_type_id: string | null;
      }>(`SELECT id, created_by, project_type_id FROM projects`);

      const projects = projectsResult.rows;
      const visibleIds = await visibleProjectIds(db, auth, projects);

      if (projectId && !visibleIds.has(projectId)) {
        throw new ApiError(403, "Sin acceso al proyecto");
      }

      let allowedIds = projects
        .filter((p) => visibleIds.has(p.id))
        .filter((p) => !projectId || p.id === projectId)
        .filter((p) => !projectTypeId || p.project_type_id === projectTypeId)
        .map((p) => p.id);

      if (allowedIds.length === 0) return okResponse({ data: [], count: 0 });

      const placeholders = allowedIds.map((_, i) => `$${i + 1}`).join(",");
      const query = `
        SELECT wn.*, COALESCE(
          (SELECT json_agg(json_build_object('user_id', ta.user_id, 'profiles', json_build_object('full_name', p.full_name, 'avatar_url', p.avatar_url)))
           FROM task_assignees ta JOIN profiles p ON p.id = ta.user_id WHERE ta.task_id = wn.id),
          '[]'::json
        ) AS task_assignees
        FROM wbs_nodes wn
        WHERE wn.project_id IN (${placeholders})
        ${responsibleId ? `AND wn.responsible_id = $${allowedIds.length + 1}` : ""}
        ${unscheduled === "true" ? "AND wn.is_unscheduled = true" : ""}
        ${unscheduled === "false" ? "AND wn.is_unscheduled = false" : ""}
        ${dateFrom ? `AND wn.end_date >= $${allowedIds.length + (responsibleId ? 2 : 1)}` : ""}
        ${dateTo ? `AND wn.start_date <= $${allowedIds.length + (responsibleId ? 2 : 1) + (dateFrom ? 1 : 0)}` : ""}
        ${search ? `AND (wn.name ILIKE '%' || $${allowedIds.length + (responsibleId ? 2 : 1) + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0)} || '%' OR wn.description ILIKE '%' || $${allowedIds.length + (responsibleId ? 2 : 1) + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0)} || '%')` : ""}
        ORDER BY
          (SELECT MIN(c.start_date) FROM wbs_nodes c WHERE c.project_id = wn.project_id AND c.start_date IS NOT NULL) ASC NULLS LAST,
          wn.project_id,
          wn.parent_id NULLS FIRST,
          wn.start_date ASC NULLS LAST,
          wn.sort_order
      `;

      const params: (string | null)[] = [...allowedIds];
      if (responsibleId) params.push(responsibleId);
      if (dateFrom) params.push(dateFrom);
      if (dateTo) params.push(dateTo);
      if (search) params.push(search);

      const result = await db.query<WbsNode>(query, params);
      const nodes = result.rows;

      let filtered = nodes;
      if (status) filtered = filtered.filter((n) => nodeStatus(n) === status);

      const requestedAssigneeId = myTasks ? auth.userId : assigneeId;
      if (requestedAssigneeId) {
        const assignments = await db.query<{ task_id: string }>(
          `SELECT task_id FROM task_assignees WHERE user_id = $1`,
          [requestedAssigneeId],
        );
        const assignedIds = new Set(assignments.rows.map((a) => a.task_id));
        const assignedTasks = filtered.filter((n) => assignedIds.has(n.id) && n.type === "task");
        filtered = myTasks ? includeAncestors(nodes, assignedTasks) : assignedTasks;
      }

      if (includeContext && projectId) filtered = nodes;

      return okResponse({ data: filtered, count: filtered.length });
    }

    // ── POST ──
    if (req.method === "POST") {
      const body = await readJson(req);
      if (body.parent_id === undefined || body.parent_id === null || body.parent_id === "") {
        throw new ApiError(400, "Selecciona un proyecto o nodo padre antes de crear este nodo");
      }
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (typeof body.parent_id !== "string" || !UUID_RE.test(body.parent_id)) {
        console.error("[wbs POST] parent_id inválido recibido:", JSON.stringify(body.parent_id), "body:", JSON.stringify(body));
        throw new ApiError(400, `El nodo padre seleccionado tiene un identificador inválido (${JSON.stringify(body.parent_id)}). Recarga la página y vuelve a seleccionar el nodo.`);
      }
      const parentId = body.parent_id;
      await assertCanManageNode(auth.userId, parentId);

      const parentResult = await db.query<{
        id: string;
        project_id: string;
        path: string;
      }>(`SELECT id, project_id, path FROM wbs_nodes WHERE id = $1`, [parentId]);

      if (parentResult.rows.length === 0) throw new ApiError(404, "Nodo padre no encontrado");
      const parent = parentResult.rows[0];

      const nodeId = crypto.randomUUID();
      const startDate = optionalDate(body.start_date, "start_date");
      const endDate = optionalDate(body.end_date, "end_date") ?? startDate;
      const type = parseNodeType(body.type);

      await db.query(
        `INSERT INTO wbs_nodes (id, project_id, parent_id, name, type, description, start_date, end_date,
          progress, estimated_hours, estimated_cost, color, sort_order, responsible_id,
          created_by, is_unscheduled, path)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
        [
          nodeId,
          parent.project_id,
          parentId,
          requireString(body.name, "name"),
          type,
          optionalString(body.description, "description"),
          startDate,
          endDate,
          optionalNumber(body.progress, "progress", 0, 1) ?? 0,
          optionalNumber(body.estimated_hours, "estimated_hours", 0) ?? 0,
          optionalNumber(body.estimated_cost, "estimated_cost", 0) ?? 0,
          optionalColor(body.color),
          optionalNumber(body.sort_order, "sort_order") ?? 0,
          optionalUuid(body.responsible_id, "responsible_id"),
          auth.userId,
          startDate === null,
          `${parent.path}.n_${nodeId.replaceAll("-", "_")}`,
        ],
      );

      const result = await db.query(
        `SELECT * FROM wbs_nodes WHERE id = $1`,
        [nodeId],
      );

      return okResponse({ data: result.rows[0] }, 201);
    }

    throw new ApiError(405, "Metodo no permitido");
  } catch (error) {
    return handleError(error);
  }
}
