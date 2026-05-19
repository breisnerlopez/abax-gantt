import { assertAssignedToTask, assertCanReportProgress, authenticate } from "../_shared/auth.ts";
import { handleCors } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/db.ts";
import { ApiError, handleError, okResponse } from "../_shared/errors.ts";
import { optionalDate, optionalNumber, optionalString, readJson, routeId } from "../_shared/validation.ts";

Deno.serve(async (req: Request) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    if (req.method !== "PATCH" && req.method !== "PUT") throw new ApiError(405, "Metodo no permitido");

    const auth = await authenticate(req);
    const db = getServiceClient();
    const id = routeId(req, "api-wbs-progress");
    await assertCanReportProgress(auth.userId, id);

    const body = await readJson(req);
    const progress = optionalNumber(body.progress, "progress", 0, 1);
    if (progress === null) throw new ApiError(400, "progress es requerido");

    const { data: node, error: nodeError } = await db
      .from("wbs_nodes")
      .update({ progress })
      .eq("id", id)
      .select()
      .single();
    if (nodeError) throw new ApiError(400, nodeError.message);

    const hours = optionalNumber(body.hours, "hours", 0);
    let timeEntry = null;
    if (hours !== null && hours > 0) {
      await assertAssignedToTask(auth.userId, id);
      const { data, error } = await db
        .from("time_entries")
        .insert({
          task_id: id,
          user_id: auth.userId,
          hours,
          notes: optionalString(body.notes, "notes"),
          entry_date: optionalDate(body.entry_date, "entry_date") ?? undefined,
        })
        .select()
        .single();
      if (error) throw new ApiError(400, error.message);
      timeEntry = data;
    }

    return okResponse({ data: { node, time_entry: timeEntry } });
  } catch (error) {
    return handleError(error);
  }
});
