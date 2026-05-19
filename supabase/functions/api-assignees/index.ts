import { assertCanManageNode, authenticate } from "../_shared/auth.ts";
import { handleCors } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/db.ts";
import { ApiError, handleError, okResponse } from "../_shared/errors.ts";
import { readJson, requireUuid } from "../_shared/validation.ts";

Deno.serve(async (req: Request) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const auth = await authenticate(req);
    const db = getServiceClient();
    const url = new URL(req.url);

    if (req.method === "GET") {
      const taskId = url.searchParams.get("task_id");
      if (!taskId) throw new ApiError(400, "task_id es requerido");

      const { data, error } = await db
        .from("task_assignees")
        .select("*, profiles!task_assignees_user_id_fkey(id, full_name, email, avatar_url, status)")
        .eq("task_id", requireUuid(taskId, "task_id"))
        .order("created_at", { ascending: true });
      if (error) throw new ApiError(500, error.message);
      return okResponse({ data, count: data?.length ?? 0 });
    }

    if (req.method === "POST") {
      const body = await readJson(req);
      const taskId = requireUuid(body.task_id, "task_id");
      const userId = requireUuid(body.user_id, "user_id");
      await assertCanManageNode(auth.userId, taskId);

      const { data: user, error: userError } = await db
        .from("profiles")
        .select("id,status")
        .eq("id", userId)
        .single();
      if (userError || !user) throw new ApiError(404, "Usuario no encontrado");
      if (user.status !== "active") throw new ApiError(400, "Usuario inactivo");

      const { data, error } = await db
        .from("task_assignees")
        .insert({ task_id: taskId, user_id: userId, assigned_by: auth.userId })
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
