import { assertAdmin, authenticate } from "../_shared/auth.ts";
import { handleCors } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/db.ts";
import { ApiError, handleError, okResponse } from "../_shared/errors.ts";
import { optionalColor, optionalString, optionalUuid, readJson, requireString } from "../_shared/validation.ts";

/**
 * /api/admin/teams
 *   GET  — lista TODOS los equipos (incluye inactivos) para la gestión.
 *   POST — crea un equipo. lead_id es opcional.
 *
 * El detalle/edit (PATCH) vive en api-admin-team.
 */
Deno.serve(async (req: Request) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const auth = await authenticate(req);
    assertAdmin(auth);
    const db = getServiceClient();

    if (req.method === "GET") {
      const { data, error } = await db
        .from("teams")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw new ApiError(500, error.message);
      return okResponse({ data, count: data?.length ?? 0 });
    }

    if (req.method === "POST") {
      const body = await readJson(req);
      const name = requireString(body.name, "name");
      const { data, error } = await db
        .from("teams")
        .insert({
          name,
          description: optionalString(body.description, "description"),
          color: optionalColor(body.color) ?? "#6366f1",
          lead_id: optionalUuid(body.lead_id, "lead_id"),
        })
        .select()
        .single();
      if (error) throw new ApiError(400, error.message);
      return okResponse({ data }, 201);
    }

    throw new ApiError(405, "Metodo no permitido");
  } catch (error) {
    return handleError(error);
  }
});
