import { assertCanManageNode, authenticate } from "./_shared/auth.ts";
import { getClient, type DbClient } from "./_shared/db.ts";
import { ApiError, handleCors, handleError, okResponse } from "./_shared/errors.ts";
import { optionalString, optionalUuid, parseNodeType, readJson, routeId } from "./_shared/validation.ts";

export async function handler(req: Request): Promise<Response> {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const auth = await authenticate(req);
    const db = getClient();
    const id = routeId(req, "api-wbs-node");

    if (req.method === "GET") {
      const result = await db.query(
        `SELECT wn.*, COALESCE(
          (SELECT json_agg(json_build_object('user_id', ta.user_id, 'profiles', json_build_object('full_name', p.full_name, 'avatar_url', p.avatar_url)))
           FROM task_assignees ta JOIN profiles p ON p.id = ta.user_id WHERE ta.task_id = wn.id),
          '[]'::json
        ) AS task_assignees
        FROM wbs_nodes wn WHERE wn.id = $1`,
        [id],
      );
      if (result.rows.length === 0) throw new ApiError(404, "Nodo no encontrado");
      return okResponse({ data: result.rows[0] });
    }

    if (req.method === "PUT" || req.method === "PATCH") {
      await assertCanManageNode(auth.userId, id);
      const body = await readJson(req);
      const fields = ["name","description","type","status","start_date","end_date","progress","estimated_hours","estimated_cost","color","sort_order","responsible_id","is_collapsed"];
      const patch: Record<string, unknown> = {};
      for (const f of fields) {
        if (body[f] !== undefined) {
          if (f === "type") patch[f] = parseNodeType(body[f]);
          else if (f === "status") {
            const v = body[f];
            if (v === null) { patch[f] = null; }
            else {
              const s = String(v);
              if (!["pendiente","en_progreso","completado","retrasado","cancelado","en_pausa","en_revision"].includes(s)) throw new ApiError(400, `Estado no soportado: ${s}`);
              patch[f] = s;
            }
          }
          else if (f === "responsible_id") patch[f] = optionalUuid(body[f], f);
          else patch[f] = body[f];
        }
      }
      if (Object.keys(patch).length === 0) throw new ApiError(400, "No hay cambios");
      const entries = Object.entries(patch);
      const setClauses = entries.map(([k], i) => `${k} = $${i + 1}`);
      const values = entries.map(([, v]) => v);
      await db.query(
        `UPDATE wbs_nodes SET ${setClauses.join(", ")}, updated_at = now() WHERE id = $${entries.length + 1}`,
        [...values, id],
      );
      const result = await db.query(`SELECT * FROM wbs_nodes WHERE id = $1`, [id]);

      if (body.start_date !== undefined || body.end_date !== undefined) {
        await propagateDatesToAncestors(db, result.rows[0] as Record<string, unknown>);
      }
      return okResponse({ data: result.rows[0] });
    }

    if (req.method === "DELETE") {
      await assertCanManageNode(auth.userId, id);
      const exists = await db.query(`SELECT 1 FROM wbs_nodes WHERE id = $1`, [id]);
      if (exists.rows.length === 0) throw new ApiError(404, "Nodo no encontrado");
      await db.query(`DELETE FROM wbs_nodes WHERE id = $1`, [id]);
      return okResponse({ data: { deleted: true } });
    }

    throw new ApiError(405, "Metodo no permitido");
  } catch (error) {
    return handleError(error);
  }
}

async function propagateDatesToAncestors(db: DbClient, node: Record<string, unknown>) {
  const nodeId = node.id as string;
  let parentId = node.parent_id as string | null;
  let safety = 0;
  while (parentId && safety < 20) {
    await db.query(
      `UPDATE wbs_nodes SET
         start_date = (SELECT MIN(start_date) FROM wbs_nodes WHERE parent_id = $1 AND start_date IS NOT NULL),
         end_date   = (SELECT MAX(end_date)   FROM wbs_nodes WHERE parent_id = $1 AND end_date IS NOT NULL),
         updated_at = now()
       WHERE id = $1 AND type IN ('project', 'stage', 'group')`,
      [parentId],
    );
    const parent = await db.query(`SELECT id, parent_id FROM wbs_nodes WHERE id = $1`, [parentId]);
    if (parent.rows.length === 0) break;
    parentId = (parent.rows[0] as Record<string, string | null>).parent_id ?? null;
    safety++;
  }
}
