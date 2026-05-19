import { assertAdmin, authenticate } from "../_shared/auth.ts";
import { handleCors } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/db.ts";
import { ApiError, handleError, okResponse } from "../_shared/errors.ts";
import { optionalColor, optionalString, readJson, requireString } from "../_shared/validation.ts";

Deno.serve(async (req: Request) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const auth = await authenticate(req);
    assertAdmin(auth);
    const db = getServiceClient();

    if (req.method === "GET") {
      const { data, error } = await db
        .from("project_types")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw new ApiError(500, error.message);
      return okResponse({ data, count: data?.length ?? 0 });
    }

    if (req.method === "POST") {
      const body = await readJson(req);
      const name = requireString(body.name, "name");
      const { data, error } = await db
        .from("project_types")
        .insert({
          name,
          description: optionalString(body.description, "description"),
          color: optionalColor(body.color) ?? "#6366f1",
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
