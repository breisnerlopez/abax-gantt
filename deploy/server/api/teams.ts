/**
 * GET /api/teams — lista de equipos activos visibles para cualquier usuario
 * autenticado. Se usa desde el frontend para habilitar la agrupación por
 * equipo del portafolio (rediseño Fase 9, handoff §5.2).
 *
 * El CRUD admin vive en admin-teams.ts (lista completa) y admin-team.ts (PATCH).
 */
import { authenticate } from "./_shared/auth.ts";
import { getClient } from "./_shared/db.ts";
import { ApiError, handleCors, handleError, okResponse } from "./_shared/errors.ts";

export async function handler(req: Request): Promise<Response> {
  const preflight = handleCors(req);
  if (preflight) return preflight;
  try {
    await authenticate(req);
    if (req.method !== "GET") throw new ApiError(405, "Metodo no permitido");
    const db = getClient();
    const r = await db.query(
      `SELECT id, name, description, color, lead_id, is_active
         FROM teams
        WHERE is_active = true
        ORDER BY name`,
    );
    return okResponse({ data: r.rows, count: r.rows.length });
  } catch (error) {
    return handleError(error);
  }
}
