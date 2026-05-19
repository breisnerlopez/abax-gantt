import { assertCanManageDependency, assertCanManageNode, authenticate } from "./_shared/auth.ts";
import { getClient } from "./_shared/db.ts";
import { ApiError, handleCors, handleError, okResponse } from "./_shared/errors.ts";
import { parseDepType, readJson, requireUuid } from "./_shared/validation.ts";

export async function handler(req: Request): Promise<Response> {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const auth = await authenticate(req);
    const db = getClient();
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const depId = pathParts[pathParts.length - 1];
    const isSingle = /^[0-9a-f-]{36}$/i.test(depId);

    if (req.method === "GET") {
      const projectId = url.searchParams.get("project_id");
      let query = `SELECT d.* FROM dependencies d`;
      const params: string[] = [];
      if (projectId) {
        query += ` JOIN wbs_nodes pred ON pred.id = d.predecessor_id WHERE pred.project_id = $1`;
        params.push(projectId);
      }
      const result = await db.query(query, params);
      return okResponse({ data: result.rows, count: result.rows.length });
    }

    if (req.method === "POST") {
      const body = await readJson(req);
      const predecessorId = requireUuid(body.predecessor_id, "predecessor_id");
      const successorId = requireUuid(body.successor_id, "successor_id");
      if (predecessorId === successorId) throw new ApiError(400, "No se puede depender de si mismo");
      const type = parseDepType(body.type);

      const [predResult, succResult] = await Promise.all([
        db.query<{project_id:string}>(`SELECT project_id FROM wbs_nodes WHERE id = $1`, [predecessorId]),
        db.query<{project_id:string}>(`SELECT project_id FROM wbs_nodes WHERE id = $1`, [successorId]),
      ]);
      const pred = predResult.rows[0];
      const succ = succResult.rows[0];
      if (!pred || !succ) throw new ApiError(404, "Nodo no encontrado");
      if (pred.project_id !== succ.project_id) throw new ApiError(400, "Las dependencias deben estar en el mismo proyecto");

      await assertCanManageDependency(auth.userId, predecessorId, successorId);

      const id = crypto.randomUUID();
      await db.query(
        `INSERT INTO dependencies (id, predecessor_id, successor_id, type, created_by) VALUES ($1,$2,$3,$4,$5)`,
        [id, predecessorId, successorId, type, auth.userId],
      );
      const result = await db.query(`SELECT * FROM dependencies WHERE id = $1`, [id]);
      return okResponse({ data: result.rows[0] }, 201);
    }

    if (req.method === "DELETE" && isSingle) {
      const {rows: [dep]} = await db.query<{successor_id:string}>(`SELECT successor_id FROM dependencies WHERE id = $1`, [depId]);
      if (!dep) throw new ApiError(404, "Dependencia no encontrada");
      await assertCanManageNode(auth.userId, dep.successor_id);
      await db.query(`DELETE FROM dependencies WHERE id = $1`, [depId]);
      return okResponse({ data: { deleted: true } });
    }

    throw new ApiError(405, "Metodo no permitido");
  } catch (error) {
    return handleError(error);
  }
}
