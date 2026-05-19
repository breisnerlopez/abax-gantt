import { assertCanManageNode, authenticate } from "../_shared/auth.ts";
import { handleCors } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/db.ts";
import { ApiError, handleError, okResponse } from "../_shared/errors.ts";
import {
  optionalBoolean,
  optionalColor,
  optionalDate,
  optionalNumber,
  optionalString,
  optionalUuid,
  readJson,
  routeId,
  requireString,
} from "../_shared/validation.ts";

Deno.serve(async (req: Request) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const auth = await authenticate(req);
    const db = getServiceClient();
    const id = routeId(req, "api-wbs-node");

    if (req.method === "GET") {
      const { data, error } = await db
        .from("wbs_nodes")
        .select("*, task_assignees(user_id, profiles!task_assignees_user_id_fkey(full_name, avatar_url))")
        .eq("id", id)
        .single();
      if (error) throw new ApiError(404, "Nodo no encontrado");

      const { data: canRead } = await db.rpc("can_read_node", {
        check_user_id: auth.userId,
        node_id: id,
      });
      if (!canRead && !auth.isAdmin) {
        const { data: assignment } = await db
          .from("task_assignees")
          .select("id")
          .eq("task_id", id)
          .eq("user_id", auth.userId)
          .maybeSingle();
        if (!assignment) throw new ApiError(403, "Sin acceso al nodo");
      }

      return okResponse({ data });
    }

    if (req.method === "PUT" || req.method === "PATCH") {
      await assertCanManageNode(auth.userId, id);
      const body = await readJson(req);
      const patch: Record<string, unknown> = {};

      if (body.name !== undefined) patch.name = requireString(body.name, "name");
      if (body.description !== undefined) patch.description = optionalString(body.description, "description");
      if (body.start_date !== undefined) patch.start_date = optionalDate(body.start_date, "start_date");
      if (body.end_date !== undefined) patch.end_date = optionalDate(body.end_date, "end_date");
      if (body.progress !== undefined) patch.progress = optionalNumber(body.progress, "progress", 0, 1);
      if (body.estimated_hours !== undefined) patch.estimated_hours = optionalNumber(body.estimated_hours, "estimated_hours", 0);
      if (body.estimated_cost !== undefined) patch.estimated_cost = optionalNumber(body.estimated_cost, "estimated_cost", 0);
      if (body.color !== undefined) patch.color = optionalColor(body.color);
      if (body.sort_order !== undefined) patch.sort_order = optionalNumber(body.sort_order, "sort_order");
      if (body.responsible_id !== undefined) patch.responsible_id = optionalUuid(body.responsible_id, "responsible_id");
      if (body.is_collapsed !== undefined) patch.is_collapsed = optionalBoolean(body.is_collapsed, "is_collapsed");

      if (patch.start_date !== undefined || patch.end_date !== undefined) {
        const startDate = patch.start_date ?? body.start_date;
        patch.is_unscheduled = startDate === null;
      }

      if (Object.keys(patch).length === 0) throw new ApiError(400, "No hay campos para actualizar");

      const { data, error } = await db.from("wbs_nodes").update(patch).eq("id", id).select().single();
      if (error) throw new ApiError(400, error.message);

      if (data.type === "project" && patch.name) {
        await db.from("projects").update({ name: patch.name }).eq("id", data.project_id);
      }

      return okResponse({ data });
    }

    if (req.method === "DELETE") {
      await assertCanManageNode(auth.userId, id);
      const { error } = await db.from("wbs_nodes").delete().eq("id", id);
      if (error) throw new ApiError(400, error.message);
      return okResponse({ data: { id } });
    }

    throw new ApiError(405, "Metodo no permitido");
  } catch (error) {
    return handleError(error);
  }
});
