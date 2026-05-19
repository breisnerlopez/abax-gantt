import { assertCanManageDependency, authenticate } from "../_shared/auth.ts";
import { handleCors } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/db.ts";
import { ApiError, handleError, okResponse } from "../_shared/errors.ts";
import { parseDependencyType, readJson, requireUuid } from "../_shared/validation.ts";

Deno.serve(async (req: Request) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const auth = await authenticate(req);
    const db = getServiceClient();
    const url = new URL(req.url);

    if (req.method === "GET") {
      const projectId = url.searchParams.get("project_id");
      let query = db.from("dependencies").select("*").order("created_at", { ascending: true });

      if (projectId) {
        const { data: nodes } = await db.from("wbs_nodes").select("id").eq("project_id", projectId);
        const ids = (nodes ?? []).map((node) => node.id);
        if (ids.length === 0) return okResponse({ data: [], count: 0 });
        query = query.or(`predecessor_id.in.(${ids.join(",")}),successor_id.in.(${ids.join(",")})`);
      }

      const { data, error } = await query;
      if (error) throw new ApiError(500, error.message);
      return okResponse({ data, count: data?.length ?? 0 });
    }

    if (req.method === "POST") {
      const body = await readJson(req);
      const predecessorId = requireUuid(body.predecessor_id, "predecessor_id");
      const successorId = requireUuid(body.successor_id, "successor_id");
      await assertCanManageDependency(auth.userId, predecessorId, successorId);

      const { data, error } = await db
        .from("dependencies")
        .insert({
          predecessor_id: predecessorId,
          successor_id: successorId,
          type: parseDependencyType(body.type),
          created_by: auth.userId,
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
