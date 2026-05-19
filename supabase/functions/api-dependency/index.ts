import { assertCanManageDependency, authenticate } from "../_shared/auth.ts";
import { handleCors } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/db.ts";
import { ApiError, handleError, okResponse } from "../_shared/errors.ts";
import { routeId } from "../_shared/validation.ts";

Deno.serve(async (req: Request) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const auth = await authenticate(req);
    const db = getServiceClient();
    const id = routeId(req, "api-dependency");

    const { data: dependency, error: readError } = await db
      .from("dependencies")
      .select("id, predecessor_id, successor_id")
      .eq("id", id)
      .single();
    if (readError || !dependency) throw new ApiError(404, "Dependencia no encontrada");

    await assertCanManageDependency(auth.userId, dependency.predecessor_id, dependency.successor_id);

    if (req.method === "DELETE") {
      const { error } = await db.from("dependencies").delete().eq("id", id);
      if (error) throw new ApiError(400, error.message);
      return okResponse({ data: { id } });
    }

    throw new ApiError(405, "Metodo no permitido");
  } catch (error) {
    return handleError(error);
  }
});
