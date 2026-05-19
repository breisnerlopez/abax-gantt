import { assertAdmin, authenticate } from "../_shared/auth.ts";
import { handleCors } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/db.ts";
import { ApiError, handleError, okResponse } from "../_shared/errors.ts";
import { optionalString, readJson, requireEmail, requireString } from "../_shared/validation.ts";

Deno.serve(async (req: Request) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const auth = await authenticate(req);
    assertAdmin(auth);
    const db = getServiceClient();

    if (req.method === "GET") {
      const { data, error } = await db
        .from("profiles")
        .select("id,email,full_name,avatar_url,status,is_admin,authentik_sub,created_at,updated_at")
        .order("created_at", { ascending: false });
      if (error) throw new ApiError(500, error.message);
      return okResponse({ data, count: data?.length ?? 0 });
    }

    if (req.method === "POST") {
      const body = await readJson(req);
      const email = requireEmail(body.email);
      const fullName = requireString(body.full_name, "full_name");

      const { data: existing } = await db
        .from("profiles")
        .select("id")
        .or(`email.eq.${email}`)
        .limit(1);

      if (existing && existing.length > 0) {
        throw new ApiError(400, "El email ya esta registrado");
      }

      const { data, error } = await db
        .from("profiles")
        .insert({
          email,
          full_name: fullName,
          avatar_url: optionalString(body.avatar_url, "avatar_url", 1000),
          authentik_sub: `pending_${crypto.randomUUID()}`,
          status: "invited",
          is_admin: false,
        })
        .select("id,email,full_name,avatar_url,status,is_admin,created_at,updated_at")
        .single();
      if (error) throw new ApiError(400, error.message);

      return okResponse({ data }, 201);
    }

    throw new ApiError(405, "Metodo no permitido");
  } catch (error) {
    return handleError(error);
  }
});
