import { AuthContext, assertCanManageNode, authenticate } from "../_shared/auth.ts";
import { handleCors } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/db.ts";
import { ApiError, handleError, okResponse } from "../_shared/errors.ts";
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
} from "../_shared/validation.ts";

type WbsNode = Record<string, unknown> & {
  id: string;
  project_id: string;
  path: string;
  type: string;
  progress: number;
  end_date: string | null;
  start_date: string | null;
  responsible_id: string | null;
};

type ProjectRow = { id: string; created_by: string; project_type_id: string | null };

function nodeStatus(node: WbsNode): string {
  const today = new Date().toISOString().slice(0, 10);
  if (node.progress >= 1) return "completado";
  if (node.end_date && node.end_date < today) return "retrasado";
  if (node.progress > 0) return "en_progreso";
  return "pendiente";
}

function includeAncestors(nodes: WbsNode[], matches: WbsNode[]): WbsNode[] {
  const byId = new Map<string, WbsNode>();
  for (const match of matches) {
    for (const node of nodes) {
      if (match.path === node.path || match.path.startsWith(`${node.path}.`)) byId.set(node.id, node);
    }
  }
  return nodes.filter((node) => byId.has(node.id));
}

async function visibleProjectIds(
  db: ReturnType<typeof getServiceClient>,
  auth: AuthContext,
  projects: ProjectRow[],
): Promise<Set<string>> {
  if (auth.isAdmin) return new Set(projects.map((p) => p.id));

  const visible = new Set(projects.filter((p) => p.created_by === auth.userId).map((p) => p.id));
  const { data: assignments } = await db
    .from("task_assignees")
    .select("task_id, wbs_nodes!inner(project_id)")
    .eq("user_id", auth.userId);
  for (const assignment of assignments ?? []) {
    const projectId = (assignment.wbs_nodes as { project_id?: string } | null)?.project_id;
    if (projectId) visible.add(projectId);
  }

  for (const project of projects) {
    if (visible.has(project.id)) continue;
    const { data: canManage } = await db.rpc("can_manage_project", {
      check_user_id: auth.userId,
      check_project_id: project.id,
    });
    if (canManage) visible.add(project.id);
  }

  return visible;
}

Deno.serve(async (req: Request) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const auth = await authenticate(req);
    const db = getServiceClient();
    const url = new URL(req.url);

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

      const { data: projects, error: projectsError } = await db
        .from("projects")
        .select("id, created_by, project_type_id");
      if (projectsError) throw new ApiError(500, projectsError.message);

      const visibleIds = await visibleProjectIds(db, auth, projects ?? []);

      if (projectId) {
        if (!visibleIds.has(projectId)) throw new ApiError(403, "Sin acceso al proyecto");
      }

      const allowedProjectIds = (projects ?? [])
        .filter((project) => visibleIds.has(project.id))
        .filter((project) => !projectId || project.id === projectId)
        .filter((project) => !projectTypeId || project.project_type_id === projectTypeId)
        .map((project) => project.id);

      if (allowedProjectIds.length === 0) return okResponse({ data: [], count: 0 });

      let query = db
        .from("wbs_nodes")
        .select("*, task_assignees(user_id, profiles!task_assignees_user_id_fkey(full_name, avatar_url))")
        .order("path", { ascending: true })
        .order("sort_order", { ascending: true });

      query = query.in("project_id", allowedProjectIds);

      if (unscheduled === "true") query = query.eq("is_unscheduled", true);
      if (unscheduled === "false") query = query.eq("is_unscheduled", false);
      if (responsibleId) query = query.eq("responsible_id", responsibleId);
      if (dateFrom) query = query.gte("end_date", dateFrom);
      if (dateTo) query = query.lte("start_date", dateTo);
      if (search) {
        const term = search.replaceAll(",", " ");
        query = query.or(`name.ilike.%${term}%,description.ilike.%${term}%`);
      }

      const { data, error } = await query;
      if (error) throw new ApiError(500, error.message);
      const nodes = (data ?? []) as WbsNode[];

      let filtered = nodes;
      if (status) filtered = filtered.filter((node) => nodeStatus(node) === status);

      const requestedAssigneeId = myTasks ? auth.userId : assigneeId;
      if (requestedAssigneeId) {
        const { data: assignments, error: assignmentsError } = await db
          .from("task_assignees")
          .select("task_id")
          .eq("user_id", requestedAssigneeId);
        if (assignmentsError) throw new ApiError(500, assignmentsError.message);
        const assignedTaskIds = new Set((assignments ?? []).map((assignment) => assignment.task_id));
        const assignedTasks = filtered.filter((node) => assignedTaskIds.has(node.id) && node.type === "task");
        filtered = myTasks ? includeAncestors(nodes, assignedTasks) : assignedTasks;
      }

      if (includeContext && projectId) filtered = nodes;

      return okResponse({ data: filtered, count: filtered.length });
    }

    if (req.method === "POST") {
      const body = await readJson(req);
      const parentId = requireUuid(body.parent_id, "parent_id");
      await assertCanManageNode(auth.userId, parentId);

      const { data: parent, error: parentError } = await db
        .from("wbs_nodes")
        .select("id, project_id, path")
        .eq("id", parentId)
        .single();
      if (parentError || !parent) throw new ApiError(404, "Nodo padre no encontrado");

      const nodeId = crypto.randomUUID();
      const startDate = optionalDate(body.start_date, "start_date");
      const endDate = optionalDate(body.end_date, "end_date") ?? startDate;
      const type = parseNodeType(body.type);

      const { data, error } = await db
        .from("wbs_nodes")
        .insert({
          id: nodeId,
          project_id: parent.project_id,
          parent_id: parentId,
          name: requireString(body.name, "name"),
          type,
          description: optionalString(body.description, "description"),
          start_date: startDate,
          end_date: endDate,
          progress: optionalNumber(body.progress, "progress", 0, 1) ?? 0,
          estimated_hours: optionalNumber(body.estimated_hours, "estimated_hours", 0),
          estimated_cost: optionalNumber(body.estimated_cost, "estimated_cost", 0),
          color: optionalColor(body.color),
          sort_order: optionalNumber(body.sort_order, "sort_order") ?? 0,
          responsible_id: optionalUuid(body.responsible_id, "responsible_id"),
          created_by: auth.userId,
          is_unscheduled: startDate === null,
          path: `${parent.path}.n_${nodeId.replaceAll("-", "_")}`,
        })
        .select()
        .single();
      if (error) throw new ApiError(400, error.message);
      return okResponse({ data }, 201);
    }

    throw new ApiError(405, "Metodo no permitido");
  } catch (error) {
    return handleError(error);
  }
});
