import { authenticate } from "../_shared/auth.ts";
import { handleCors } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/db.ts";
import { ApiError, handleError, okResponse } from "../_shared/errors.ts";

/**
 * GET /api/teams — listado de equipos visibles para cualquier usuario autenticado.
 * Sólo se devuelven equipos activos (is_active = true). El uso principal es la
 * agrupación "Equipo" del portafolio (rediseño Fase 9 / handoff §5.2).
 *
 * El CRUD admin vive en api-admin-teams + api-admin-team.
 */
Deno.serve(async (req: Request) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    await authenticate(req);
    if (req.method !== "GET") throw new ApiError(405, "Metodo no permitido");

    const db = getServiceClient();
    const { data, error } = await db
      .from("teams")
      .select("id,name,description,color,lead_id,is_active")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) throw new ApiError(500, error.message);
    return okResponse({ data, count: data?.length ?? 0 });
  } catch (error) {
    return handleError(error);
  }
});
