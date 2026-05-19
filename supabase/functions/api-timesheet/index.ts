import { assertAssignedToTask, authenticate } from "../_shared/auth.ts";
import { handleCors } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/db.ts";
import { ApiError, handleError, okResponse } from "../_shared/errors.ts";
import { optionalDate, optionalNumber, optionalString, readJson, requireUuid } from "../_shared/validation.ts";

Deno.serve(async (req: Request) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const auth = await authenticate(req);
    const url = new URL(req.url);

    if (req.method === "GET") {
      const db = getServiceClient();
      const taskId = url.searchParams.get("task_id");
      const userId = url.searchParams.get("user_id");

      let query = db
        .from("time_entries")
        .select("*, profiles(id, full_name, avatar_url)")
        .order("entry_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (taskId) query = query.eq("task_id", requireUuid(taskId, "task_id"));
      if (userId) query = query.eq("user_id", requireUuid(userId, "user_id"));
      if (!auth.isAdmin && !taskId && !userId) {
        query = query.eq("user_id", auth.userId);
      }

      const { data, error } = await query;
      if (error) throw new ApiError(500, error.message);
      return okResponse({ data, count: data?.length ?? 0 });
    }

    if (req.method === "POST") {
      const db = getServiceClient();
      const body = await readJson(req);
      const taskId = requireUuid(body.task_id, "task_id");
      await assertAssignedToTask(auth.userId, taskId);

      const hours = optionalNumber(body.hours, "hours", 0);
      if (hours === null || hours <= 0) throw new ApiError(400, "hours debe ser mayor a 0");

      const { data, error } = await db
        .from("time_entries")
        .insert({
          task_id: taskId,
          user_id: auth.userId,
          hours,
          notes: optionalString(body.notes, "notes"),
          entry_date: optionalDate(body.entry_date, "entry_date") ?? undefined,
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
