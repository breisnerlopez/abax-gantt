import { authenticate } from "./_shared/auth.ts";
import { getClient } from "./_shared/db.ts";
import { handleCors, handleError, okResponse } from "./_shared/errors.ts";

export async function handler(req: Request): Promise<Response> {
  const preflight = handleCors(req);
  if (preflight) return preflight;
  try {
    await authenticate(req);
    const db = getClient();
    const url = new URL(req.url);
    const projectId = url.searchParams.get("project_id");
    let query = `SELECT wn.*, COALESCE((SELECT json_agg(json_build_object('user_id', ta.user_id, 'profiles', json_build_object('full_name', p.full_name))) FROM task_assignees ta JOIN profiles p ON p.id = ta.user_id WHERE ta.task_id = wn.id),'[]'::json) AS task_assignees FROM wbs_nodes wn WHERE wn.is_unscheduled = true`;
    const params: string[] = [];
    if (projectId) { query += ` AND wn.project_id = $1`; params.push(projectId); }
    query += ` ORDER BY wn.path, wn.sort_order`;
    const result = await db.query(query, params);
    return okResponse({ data: result.rows, count: result.rows.length });
  } catch (error) {
    return handleError(error);
  }
}
