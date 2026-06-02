import { assertAdmin, authenticate } from "../_shared/auth.ts";
import { handleCors } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/db.ts";
import { ApiError, handleError, okResponse } from "../_shared/errors.ts";
import { optionalBoolean, optionalColor, optionalString, optionalUuid, readJson, routeId, requireString } from "../_shared/validation.ts";

/**
 * /api/admin/teams/:id
 *   PATCH/PUT — actualiza name, description, color, lead_id, is_active.
 *
 * No exponemos DELETE: usamos `is_active=false` para preservar las FKs de los
 * proyectos que ya hayan referenciado al equipo. Mismo patrón que project_types.
 */
Deno.serve(async (req: Request) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const auth = await authenticate(req);
    assertAdmin(auth);
    const db = getServiceClient();
    const id = routeId(req, "api-admin-team");

    if (req.method !== "PUT" && req.method !== "PATCH") {
      throw new ApiError(405, "Metodo no permitido");
    }

    const body = await readJson(req);
    const patch: Record<string, unknown> = {};

    if (body.name !== undefined) patch.name = requireString(body.name, "name");
    if (body.description !== undefined) patch.description = optionalString(body.description, "description");
    if (body.color !== undefined) patch.color = optionalColor(body.color);
    if (body.lead_id !== undefined) patch.lead_id = optionalUuid(body.lead_id, "lead_id");
    if (body.is_active !== undefined) patch.is_active = optionalBoolean(body.is_active, "is_active");

    if (Object.keys(patch).length === 0) throw new ApiError(400, "No hay campos para actualizar");

    // Aviso para el admin: si está desactivando un equipo con proyectos activos,
    // los proyectos quedan referenciando un equipo "archivado" — el frontend lo
    // dibujará en el bucket "Sin equipo".
    if (body.is_active === false) {
      const { count, error: countError } = await db
        .from("projects")
        .select("*", { count: "exact", head: true })
        .eq("team_id", id)
        .eq("status", "active");
      if (countError) throw new ApiError(500, countError.message);
      if (count !== null && count > 0) {
        // No bloqueamos (a diferencia de project_types) — sólo informamos por log,
        // ya que los proyectos siguen visibles, sólo migra su agrupación.
        console.log(`[api-admin-team] desactivando team ${id} con ${count} proyectos activos asociados`);
      }
    }

    const { data, error } = await db
      .from("teams")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new ApiError(400, error.message);
    return okResponse({ data });
  } catch (error) {
    return handleError(error);
  }
});
