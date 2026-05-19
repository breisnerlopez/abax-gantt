import { authenticate } from "./_shared/auth.ts";
import { getClient } from "./_shared/db.ts";
import { handleCors, handleError, okResponse } from "./_shared/errors.ts";

export async function handler(req: Request): Promise<Response> {
  const preflight = handleCors(req);
  if (preflight) return preflight;
  try {
    await authenticate(req);
    const db = getClient();
    const r = await db.query(`SELECT id, email, full_name, avatar_url, status, is_admin FROM profiles WHERE status = 'active' ORDER BY full_name`);
    return okResponse({ data: r.rows, count: r.rows.length });
  } catch (error) {
    return handleError(error);
  }
}
