/**
 * PATCH /api/admin/teams/:id — actualiza name, description, color, lead_id,
 * is_active. No exponemos DELETE: si un admin desactiva un equipo con
 * proyectos activos, los proyectos siguen visibles en bucket "Sin equipo"
 * gracias a `ON DELETE SET NULL` de la FK y el comportamiento del frontend.
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

    const url = new URL(req.url);
    const m = url.pathname.match(/^\/api\/admin\/teams\/([0-9a-f-]{36})$/i);
    if (!m) throw new ApiError(400, "id requerido en la ruta");
    const id = m[1];

    if (req.method !== "PUT" && req.method !== "PATCH") {
      throw new ApiError(405, "Metodo no permitido");
    }

    const body = await readJson(req);
    const patch: Record<string, unknown> = {};
    if (body.name !== undefined) patch.name = requireString(body.name, "name");
    if (body.description !== undefined) patch.description = optionalString(body.description, "description");
    if (body.color !== undefined) patch.color = String(body.color);
    if (body.lead_id !== undefined) patch.lead_id = optionalUuid(body.lead_id, "lead_id");
    if (body.is_active !== undefined) patch.is_active = !!body.is_active;
    if (Object.keys(patch).length === 0) throw new ApiError(400, "No hay cambios");

    const db = getClient();
    const entries = Object.entries(patch);
    const set = entries.map(([k], i) => `${k}=$${i + 1}`).join(",");
    await db.query(`UPDATE teams SET ${set} WHERE id=$${entries.length + 1}`, [
      ...entries.map(([, v]) => v),
      id,
    ]);
    const r = await db.query(`SELECT * FROM teams WHERE id = $1`, [id]);
    if (r.rows.length === 0) throw new ApiError(404, "Equipo no encontrado");
    return okResponse({ data: r.rows[0] });
  } catch (error) {
    return handleError(error);
  }
}
