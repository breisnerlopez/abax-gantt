import { assertCanReportProgress, authenticate } from "./_shared/auth.ts";
import { getClient } from "./_shared/db.ts";
import { ApiError, handleCors, handleError, okResponse } from "./_shared/errors.ts";
import { optionalNumber, readJson, routeId } from "./_shared/validation.ts";

export async function handler(req: Request): Promise<Response> {
  const preflight = handleCors(req);
  if (preflight) return preflight;
  try {
    if (req.method !== "PATCH" && req.method !== "PUT") throw new ApiError(405, "Metodo no permitido");
    const auth = await authenticate(req);
    const db = getClient();
    const id = routeId(req, "api-wbs-progress");
    await assertCanReportProgress(auth.userId, id);
    const body = await readJson(req);
    const progress = optionalNumber(body.progress, "progress", 0, 1);
    const hours = optionalNumber(body.hours, "hours", 0);
    if (progress === null) throw new ApiError(400, "progress requerido");

    await db.query(`UPDATE wbs_nodes SET progress=$1, updated_at=now() WHERE id=$2`, [progress, id]);

    if (hours !== null && hours > 0) {
      const timeId = crypto.randomUUID();
      await db.query(
        `INSERT INTO time_entries (id, task_id, user_id, hours, entry_date) VALUES ($1,$2,$3,$4,CURRENT_DATE)`,
        [timeId, id, auth.userId, hours],
      );
    }

    const result = await db.query(`SELECT * FROM wbs_nodes WHERE id = $1`, [id]);
    return okResponse({ data: { node: result.rows[0], hours_registered: hours } });
  } catch (error) {
    return handleError(error);
  }
}
