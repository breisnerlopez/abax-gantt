/**
 * /api/admin/teams
 *   GET  — lista TODOS los equipos (incluye inactivos) para la gestión.
 *   POST — crea un equipo. Solo admin.
 *
 * El detalle/edit (PATCH) vive en admin-team.ts. No exponemos DELETE: usamos
 * is_active=false para preservar las FKs de los proyectos que referencien el
 * equipo. Mismo patrón que project_types.
 */
import { authenticate } from "./_shared/auth.ts";
import { getClient } from "./_shared/db.ts";
import { ApiError, handleCors, handleError, okResponse } from "./_shared/errors.ts";
import { optionalString, optionalUuid, readJson, requireString } from "./_shared/validation.ts";

export async function handler(req: Request): Promise<Response> {
  const preflight = handleCors(req);
  if (preflight) return preflight;
  try {
    const auth = await authenticate(req);
    if (!auth.isAdmin) throw new ApiError(403, "Solo administradores");
    const db = getClient();

    if (req.method === "GET") {
      const r = await db.query(
        `SELECT id, name, description, color, lead_id, is_active, created_at, updated_at
           FROM teams
          ORDER BY name`,
      );
      return okResponse({ data: r.rows, count: r.rows.length });
    }

    if (req.method === "POST") {
      const body = await readJson(req);
      const id = crypto.randomUUID();
      const name = requireString(body.name, "name");
      const description = optionalString(body.description, "description");
      const color = String(body.color || "#6366f1");
      const leadId = optionalUuid(body.lead_id, "lead_id");
      await db.query(
        `INSERT INTO teams (id, name, description, color, lead_id)
              VALUES ($1, $2, $3, $4, $5)`,
        [id, name, description, color, leadId],
      );
      const r = await db.query(`SELECT * FROM teams WHERE id = $1`, [id]);
      return okResponse({ data: r.rows[0] }, 201);
    }

    throw new ApiError(405, "Metodo no permitido");
  } catch (error) {
    return handleError(error);
  }
}
