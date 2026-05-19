import { assertCanManageProject, authenticate } from "./_shared/auth.ts";
import { getClient } from "./_shared/db.ts";
import { ApiError, handleCors, handleError, okResponse } from "./_shared/errors.ts";
import { optionalBoolean, optionalNumber, optionalString, optionalUuid, readJson, requireString } from "./_shared/validation.ts";

export async function handler(req: Request): Promise<Response> {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const auth = await authenticate(req);
    const db = getClient();
    const url = new URL(req.url);
    const id = url.pathname.split("/").filter(Boolean).pop();

    if (req.method === "GET") {
      if (id && /^[0-9a-f-]{36}$/i.test(id)) {
        const result = await db.query(
          `SELECT p.*, pt.name AS type_name, pt.color AS type_color
           FROM projects p LEFT JOIN project_types pt ON pt.id = p.project_type_id
           WHERE p.id = $1`,
          [id],
        );
        if (result.rows.length === 0) throw new ApiError(404, "Proyecto no encontrado");
        return okResponse({ data: result.rows[0] });
      }

      const result = await db.query(
        `SELECT p.*, pt.name AS type_name, pt.color AS type_color
         FROM projects p LEFT JOIN project_types pt ON pt.id = p.project_type_id
         ORDER BY p.created_at DESC`,
      );

      let projects = result.rows;
      if (!auth.isAdmin) {
        const visible = new Set<string>();
        for (const p of projects) {
          if ((p as Record<string,string>).created_by === auth.userId) { visible.add((p as Record<string,string>).id); continue; }
          const r = await db.query<{ can_manage: boolean }>(
            `SELECT can_manage_project($1, $2) AS can_manage`,
            [auth.userId, (p as Record<string,string>).id],
          );
          if (r.rows[0]?.can_manage) visible.add((p as Record<string,string>).id);
        }
        // V-09 fix: incluir proyectos donde el usuario es responsable de cualquier nodo del árbol,
        // no sólo del root. Antes el responsable de una etapa no veía el proyecto que la contiene.
        const responsibleResult = await db.query<{ project_id: string }>(
          `SELECT DISTINCT project_id FROM wbs_nodes WHERE responsible_id = $1`,
          [auth.userId],
        );
        for (const row of responsibleResult.rows) visible.add(row.project_id);
        const assignResult = await db.query<{ project_id: string }>(
          `SELECT wn.project_id FROM task_assignees ta JOIN wbs_nodes wn ON wn.id = ta.task_id WHERE ta.user_id = $1`,
          [auth.userId],
        );
        for (const row of assignResult.rows) visible.add(row.project_id);
        projects = projects.filter((p) => visible.has((p as Record<string,string>).id));
      }

      return okResponse({ data: projects, count: projects.length });
    }

    if (req.method === "POST") {
      const body = await readJson(req);
      const name = requireString(body.name, "name");
      const projectId = crypto.randomUUID();

      await db.query(
        `INSERT INTO projects (id, name, description, project_type_id, budget_total, autoscheduling_enabled, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          projectId,
          name,
          optionalString(body.description, "description"),
          optionalUuid(body.project_type_id, "project_type_id"),
          optionalNumber(body.budget_total, "budget_total", 0) ?? 0,
          optionalBoolean(body.autoscheduling_enabled, "autoscheduling_enabled") ?? true,
          auth.userId,
        ],
      );

      const nodeId = crypto.randomUUID();
      await db.query(
        `INSERT INTO wbs_nodes (id, project_id, parent_id, name, type, created_by, is_unscheduled, responsible_id, path)
         VALUES ($1, $2, NULL, $3, 'project', $4, false, $4, $5)`,
        [nodeId, projectId, name, auth.userId, `n_${nodeId.replaceAll("-", "_")}`],
      );

      const result = await db.query(`SELECT * FROM projects WHERE id = $1`, [projectId]);
      const nodeResult = await db.query(`SELECT * FROM wbs_nodes WHERE id = $1`, [nodeId]);
      return okResponse({
        data: {
          ...(result.rows[0] as Record<string, unknown>),
          root_node_id: nodeId,
          root_node: nodeResult.rows[0],
        },
      }, 201);
    }

    if ((req.method === "PUT" || req.method === "PATCH") && id) {
      await assertCanManageProject(auth.userId, id);
      const body = await readJson(req);
      const patch: Record<string, unknown> = {};
      const fields = ["name","description","project_type_id","budget_total","autoscheduling_enabled","status"];
      for (const f of fields) {
        if (body[f] !== undefined) patch[f] = body[f];
      }
      if (Object.keys(patch).length === 0) throw new ApiError(400, "No hay cambios");
      const setClauses = Object.keys(patch).map((k,i) => `${k} = $${i+1}`);
      await db.query(`UPDATE projects SET ${setClauses.join(", ")} WHERE id = $${Object.keys(patch).length + 1}`, [...Object.values(patch), id]);
      const result = await db.query(`SELECT * FROM projects WHERE id = $1`, [id]);
      return okResponse({ data: result.rows[0] });
    }

    if (req.method === "DELETE" && id) {
      await assertCanManageProject(auth.userId, id);
      await db.query(`UPDATE projects SET status = 'archived' WHERE id = $1`, [id]);
      return okResponse({ data: { archived: true } });
    }

    throw new ApiError(405, "Metodo no permitido");
  } catch (error) {
    return handleError(error);
  }
}
