import { authenticate } from "../_shared/auth.ts";
import { handleCors } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/db.ts";
import { ApiError, handleError, okResponse } from "../_shared/errors.ts";

Deno.serve(async (req: Request) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    await authenticate(req);

    if (req.method !== "GET") throw new ApiError(405, "Metodo no permitido");

    const db = getServiceClient();
    const url = new URL(req.url);
    const search = url.searchParams.get("q")?.trim();

    let query = db
      .from("profiles")
      .select("id,email,full_name,avatar_url,status,is_admin")
      .eq("status", "active")
      .order("full_name", { ascending: true })
      .limit(100);

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) throw new ApiError(500, error.message);

    return okResponse({ data, count: data?.length ?? 0 });
  } catch (error) {
    return handleError(error);
  }
});
