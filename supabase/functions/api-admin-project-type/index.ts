import { assertAdmin, authenticate } from "../_shared/auth.ts";
import { handleCors } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/db.ts";
import { ApiError, handleError, okResponse } from "../_shared/errors.ts";
import { optionalBoolean, optionalColor, optionalString, readJson, routeId, requireString } from "../_shared/validation.ts";

Deno.serve(async (req: Request) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const auth = await authenticate(req);
    assertAdmin(auth);
    const db = getServiceClient();
    const id = routeId(req, "api-admin-project-type");

    if (req.method === "PUT" || req.method === "PATCH") {
      const body = await readJson(req);
      const patch: Record<string, unknown> = {};

      if (body.name !== undefined) patch.name = requireString(body.name, "name");
      if (body.description !== undefined) patch.description = optionalString(body.description, "description");
      if (body.color !== undefined) patch.color = optionalColor(body.color);
      if (body.is_active !== undefined) patch.is_active = optionalBoolean(body.is_active, "is_active");

      if (body.is_active === false) {
        const { count, error: countError } = await db
          .from("projects")
          .select("*", { count: "exact", head: true })
          .eq("project_type_id", id)
          .eq("status", "active");
        if (countError) throw new ApiError(500, countError.message);
        if (count !== null && count > 0) throw new ApiError(400, "No se puede desactivar un tipo con proyectos activos asociados");
      }

      if (Object.keys(patch).length === 0) throw new ApiError(400, "No hay campos para actualizar");

      const { data, error } = await db
        .from("project_types")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw new ApiError(400, error.message);
      return okResponse({ data });
    }

    throw new ApiError(405, "Metodo no permitido");
  } catch (error) {
    return handleError(error);
  }
});
