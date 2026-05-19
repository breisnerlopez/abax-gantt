import { assertAdmin, authenticate } from "../_shared/auth.ts";
import { handleCors } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/db.ts";
import { ApiError, handleError, okResponse } from "../_shared/errors.ts";
import { optionalString, parseUserStatus, readJson, routeId, requireString } from "../_shared/validation.ts";

Deno.serve(async (req: Request) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const auth = await authenticate(req);
    assertAdmin(auth);
    const db = getServiceClient();
    const id = routeId(req, "api-admin-user");

    if (req.method === "PUT" || req.method === "PATCH") {
      if (id === auth.userId) throw new ApiError(400, "No puedes modificar tu propio perfil administrativo desde este endpoint");
      const body = await readJson(req);
      const patch: Record<string, unknown> = {};

      if (body.full_name !== undefined) patch.full_name = requireString(body.full_name, "full_name");
      if (body.avatar_url !== undefined) patch.avatar_url = optionalString(body.avatar_url, "avatar_url", 1000);
      if (body.status !== undefined) patch.status = parseUserStatus(body.status);
      if (body.is_admin !== undefined) {
        if (typeof body.is_admin !== "boolean") throw new ApiError(400, "is_admin debe ser booleano");
        patch.is_admin = body.is_admin;
      }

      if (Object.keys(patch).length === 0) throw new ApiError(400, "No hay campos para actualizar");

      const { data, error } = await db
        .from("profiles")
        .update(patch)
        .eq("id", id)
        .select("id,email,full_name,avatar_url,status,is_admin,created_at,updated_at")
        .single();
      if (error) throw new ApiError(400, error.message);
      return okResponse({ data });
    }

    throw new ApiError(405, "Metodo no permitido");
  } catch (error) {
    return handleError(error);
  }
});
