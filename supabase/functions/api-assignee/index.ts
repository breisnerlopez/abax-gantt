import { assertCanManageNode, authenticate } from "../_shared/auth.ts";
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
    const id = routeId(req, "api-assignee");

    const { data: assignee, error: readError } = await db
      .from("task_assignees")
      .select("id, task_id")
      .eq("id", id)
      .single();
    if (readError || !assignee) throw new ApiError(404, "Asignacion no encontrada");

    await assertCanManageNode(auth.userId, assignee.task_id);

    if (req.method === "DELETE") {
      const { error } = await db.from("task_assignees").delete().eq("id", id);
      if (error) throw new ApiError(400, error.message);
      return okResponse({ data: { id } });
    }

    throw new ApiError(405, "Metodo no permitido");
  } catch (error) {
    return handleError(error);
  }
});
