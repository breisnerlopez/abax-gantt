import { authenticate } from "../_shared/auth.ts";
import { handleCors } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/db.ts";
import { ApiError, handleError, okResponse } from "../_shared/errors.ts";

Deno.serve(async (req: Request) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const auth = await authenticate(req);
    const db = getServiceClient();
    const url = new URL(req.url);

    if (req.method !== "GET") throw new ApiError(405, "Metodo no permitido");

    const projectId = url.searchParams.get("project_id");

    let query = db
      .from("wbs_nodes")
      .select("*, task_assignees(user_id, profiles!task_assignees_user_id_fkey(full_name, avatar_url))")
      .eq("is_unscheduled", true)
      .order("project_id", { ascending: true })
      .order("path", { ascending: true })
      .order("sort_order", { ascending: true });

    if (projectId) {
      query = query.eq("project_id", projectId);
    } else if (!auth.isAdmin) {
      const { data: visibleProjects } = await db
        .from("projects")
        .select("id")
        .or(`created_by.eq.${auth.userId}`);
      const projectIds = (visibleProjects ?? []).map((p) => p.id);
      if (projectIds.length === 0) return okResponse({ data: [], count: 0 });
      query = query.in("project_id", projectIds);
    }

    const { data, error } = await query;
    if (error) throw new ApiError(500, error.message);
    return okResponse({ data, count: data?.length ?? 0 });
  } catch (error) {
    return handleError(error);
  }
});
