import { assertAssignedToTask, authenticate } from "./_shared/auth.ts";
import { getClient } from "./_shared/db.ts";
import { ApiError, handleCors, handleError, okResponse } from "./_shared/errors.ts";
import { optionalNumber, readJson, requireUuid } from "./_shared/validation.ts";

export async function handler(req: Request): Promise<Response> {
  const preflight = handleCors(req);
  if (preflight) return preflight;
  try {
    const auth = await authenticate(req);
    const db = getClient();
    const url = new URL(req.url);

    if (req.method === "GET") {
      const taskId = url.searchParams.get("task_id");
      const userId = url.searchParams.get("user_id");
      let q = `SELECT te.*, p.full_name, p.email FROM time_entries te JOIN profiles p ON p.id = te.user_id WHERE 1=1`;
      const params: (string|number)[] = []; let i = 1;
      if (taskId) { q += ` AND te.task_id = $${i++}`; params.push(taskId); }
      if (userId) { q += ` AND te.user_id = $${i++}`; params.push(userId); }
      q += ` ORDER BY te.entry_date DESC, te.created_at DESC LIMIT 200`;
      const r = await db.query(q, params);
      return okResponse({ data: r.rows, count: r.rows.length });
    }

    if (req.method === "POST") {
      const body = await readJson(req);
      const taskId = requireUuid(body.task_id, "task_id");
      await assertAssignedToTask(auth.userId, taskId);
      const hours = optionalNumber(body.hours, "hours", 0.01);
      if (!hours || hours <= 0) throw new ApiError(400, "hours debe ser > 0");
      const id = crypto.randomUUID();
      await db.query(
        `INSERT INTO time_entries (id, task_id, user_id, hours, notes, entry_date) VALUES ($1,$2,$3,$4,$5,COALESCE($6::date,CURRENT_DATE))`,
        [id, taskId, auth.userId, hours, String(body.notes ?? ""), body.entry_date ?? null],
      );
      const r = await db.query(`SELECT * FROM time_entries WHERE id = $1`, [id]);
      return okResponse({ data: r.rows[0] }, 201);
    }

    throw new ApiError(405, "Metodo no permitido");
  } catch (error) {
    return handleError(error);
  }
}
