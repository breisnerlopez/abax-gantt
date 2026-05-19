import { authenticate, assertCanManageProject } from "../_shared/auth.ts";
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
    const id = routeId(req, "api-attachment");

    const { data: attachment, error: readError } = await db
      .from("attachments")
      .select("id, project_id, file_path, file_name")
      .eq("id", id)
      .single();
    if (readError || !attachment) throw new ApiError(404, "Adjunto no encontrado");

    await assertCanManageProject(auth.userId, attachment.project_id);

    if (req.method !== "DELETE") throw new ApiError(405, "Metodo no permitido");

    const { error: removeError } = await db.storage
      .from("attachments")
      .remove([attachment.file_path]);
    if (removeError) {
      console.warn("Storage remove warning:", removeError.message);
    }

    const { error } = await db.from("attachments").delete().eq("id", id);
    if (error) throw new ApiError(400, error.message);

    return okResponse({ data: { id, file_name: attachment.file_name } });
  } catch (error) {
    return handleError(error);
  }
});
