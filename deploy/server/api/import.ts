import { authenticate } from "./_shared/auth.ts";
import { getClient } from "./_shared/db.ts";
import { ApiError, handleCors, handleError, okResponse } from "./_shared/errors.ts";
import { readJson } from "./_shared/validation.ts";

export async function handler(req: Request): Promise<Response> {
  const preflight = handleCors(req);
  if (preflight) return preflight;
  try {
    if (req.method !== "POST") throw new ApiError(405, "Metodo no permitido");
    const auth = await authenticate(req);
    const db = getClient();
    const body = await readJson(req);
    const rows = body.rows;
    if (!Array.isArray(rows) || rows.length === 0) throw new ApiError(400, "Debe proveer `rows` como array");

    let imported = 0;
    for (const row of rows) {
      if (!row.name || !row.project_id) continue;
      const id = crypto.randomUUID();
      const parentId = row.parent_id || null;
      let path = `n_${id.replaceAll("-","_")}`;
      if (parentId) {
        const {rows: [parent]} = await db.query<{path:string}>(`SELECT path FROM wbs_nodes WHERE id = $1`, [parentId]);
        if (parent) path = `${parent.path}.${path}`;
      }
      await db.query(
        `INSERT INTO wbs_nodes (id, project_id, parent_id, name, type, start_date, end_date, progress, estimated_hours, estimated_cost, is_unscheduled, path, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [id, row.project_id, parentId, row.name, row.type || "task", row.start_date || null, row.end_date || null, row.progress || 0, row.estimated_hours || 0, row.estimated_cost || 0, !row.start_date, path, auth.userId],
      );
      imported++;
    }
    return okResponse({ data: { imported_count: imported } }, 201);
  } catch (error) {
    return handleError(error);
  }
}
