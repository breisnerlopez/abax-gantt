import { assertCanManageNode, authenticate } from "./_shared/auth.ts";
import { getClient } from "./_shared/db.ts";
import { ApiError, handleCors, handleError, okResponse } from "./_shared/errors.ts";
import { readJson, requireUuid } from "./_shared/validation.ts";

export async function handler(req: Request): Promise<Response> {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const auth = await authenticate(req);
    const db = getClient();
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const last = pathParts[pathParts.length - 1];
    const isDelete = /^[0-9a-f-]{36}$/i.test(last);

    if (req.method === "GET") {
      const taskId = url.searchParams.get("task_id");
      if (!taskId) throw new ApiError(400, "task_id requerido");
      const result = await db.query(
        `SELECT ta.*, p.full_name, p.email, p.avatar_url
         FROM task_assignees ta JOIN profiles p ON p.id = ta.user_id
         WHERE ta.task_id = $1`,
        [taskId],
      );
      return okResponse({ data: result.rows, count: result.rows.length });
    }

    if (req.method === "POST") {
      const body = await readJson(req);
      const taskId = requireUuid(body.task_id, "task_id");
      const userId = requireUuid(body.user_id, "user_id");

      await assertCanManageNode(auth.userId, taskId);

      const {rows: [user]} = await db.query<{status:string}>(`SELECT status FROM profiles WHERE id = $1`, [userId]);
      if (!user) throw new ApiError(404, "Usuario no encontrado");
      if (user.status !== "active") throw new ApiError(400, "Usuario inactivo");

      const id = crypto.randomUUID();
      await db.query(
        `INSERT INTO task_assignees (id, task_id, user_id, assigned_by) VALUES ($1,$2,$3,$4)`,
        [id, taskId, userId, auth.userId],
      );
      const result = await db.query(`SELECT * FROM task_assignees WHERE id = $1`, [id]);
      return okResponse({ data: result.rows[0] }, 201);
    }

    if (req.method === "DELETE" && isDelete) {
      const {rows: [row]} = await db.query<{task_id:string}>(`SELECT task_id FROM task_assignees WHERE id = $1`, [last]);
      if (!row) throw new ApiError(404, "Asignacion no encontrada");
      await assertCanManageNode(auth.userId, row.task_id);
      await db.query(`DELETE FROM task_assignees WHERE id = $1`, [last]);
      return okResponse({ data: { deleted: true } });
    }

    throw new ApiError(405, "Metodo no permitido");
  } catch (error) {
    return handleError(error);
  }
}
