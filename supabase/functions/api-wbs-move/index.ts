import { assertCanManageNode, authenticate } from "../_shared/auth.ts";
import { handleCors } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/db.ts";
import { ApiError, handleError, okResponse } from "../_shared/errors.ts";
import { optionalNumber, optionalUuid, readJson, routeId } from "../_shared/validation.ts";

Deno.serve(async (req: Request) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    if (req.method !== "PATCH" && req.method !== "PUT") throw new ApiError(405, "Metodo no permitido");

    const auth = await authenticate(req);
    const db = getServiceClient();
    const id = routeId(req, "api-wbs-move");
    const body = await readJson(req);

    const { data: node, error: nodeError } = await db
      .from("wbs_nodes")
      .select("id, parent_id, project_id, path, type, name, created_by")
      .eq("id", id)
      .single();
    if (nodeError || !node) throw new ApiError(404, "Nodo no encontrado");

    await assertCanManageNode(auth.userId, id);

    const newParentId = optionalUuid(body.parent_id, "parent_id");
    const newSortOrder = optionalNumber(body.sort_order, "sort_order");

    let targetProjectId = node.project_id;
    let parentPath = "";

    if (newParentId !== null && newParentId !== node.parent_id) {
      if (newParentId === id) throw new ApiError(400, "Un nodo no puede ser padre de si mismo");

      const { data: parent, error: parentError } = await db
        .from("wbs_nodes")
        .select("id, project_id, path, type")
        .eq("id", newParentId)
        .single();
      if (parentError || !parent) throw new ApiError(404, "Nodo padre no encontrado");

      await assertCanManageNode(auth.userId, newParentId);
      targetProjectId = parent.project_id;
      parentPath = parent.path;

      if (targetProjectId !== node.project_id) {
        const { data: dependencies, error: depError } = await db
          .from("dependencies")
          .select("id")
          .or(`predecessor_id.eq.${id},successor_id.eq.${id}`)
          .limit(1);
        if (depError) throw new ApiError(500, depError.message);
        if ((dependencies ?? []).length > 0) {
          return okResponse({
            data: null,
            warnings: [{
              code: "DEPENDENCY_VIOLATION",
              message: "No se puede mover a otro proyecto con dependencias existentes",
              dependency_id: dependencies?.[0]?.id ?? null,
            }],
          }, 409);
        }
      }

      const { data: descendants, error: descError } = await db
        .from("wbs_nodes")
        .select("id")
        .filter("path", "ltree", node.path);
      if (descError) throw new ApiError(500, descError.message);
      if (descendants?.some((d: { id: string }) => d.id === newParentId)) {
        throw new ApiError(400, "No se puede mover un nodo debajo de uno de sus descendientes");
      }
    }

    const patch: Record<string, unknown> = {};
    if (newParentId !== null && newParentId !== node.parent_id) {
      patch.parent_id = newParentId;
      patch.project_id = targetProjectId;
    }
    if (newSortOrder !== null) {
      patch.sort_order = newSortOrder;
    }

    if (Object.keys(patch).length === 0) throw new ApiError(400, "No hay cambios que aplicar");

    const { data: updated, error: updateError } = await db
      .from("wbs_nodes")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (updateError) throw new ApiError(400, updateError.message);

    if (newParentId !== null && newParentId !== node.parent_id) {
      const newPathLabel = `n_${id.replaceAll("-", "_")}`;
      const newPath = parentPath ? `${parentPath}.${newPathLabel}` : newPathLabel;
      await db.from("wbs_nodes").update({ path: newPath }).eq("id", id);

      let oldPathPrefix = node.path;
      let counter = 0;
      while (true) {
        const { data: children, error: childrenError } = await db
          .from("wbs_nodes")
          .select("id, path")
          .filter("path", "ltree", oldPathPrefix)
          .neq("id", id)
          .limit(100);
        if (childrenError) throw new ApiError(500, childrenError.message);
        if (!children || children.length === 0) break;

        for (const child of children) {
          const suffix = child.path.replace(oldPathPrefix, "");
          await db.from("wbs_nodes").update({ path: `${newPath}${suffix}` }).eq("id", child.id);
        }
        counter += children.length;
        if (counter > 5000) throw new ApiError(400, "Demasiados nodos para mover");
      }
    }

    const { data: freshNode, error: freshError } = await db
      .from("wbs_nodes")
      .select("*")
      .eq("id", id)
      .single();
    if (freshError) throw new ApiError(500, freshError.message);

    return okResponse({ data: freshNode });
  } catch (error) {
    return handleError(error);
  }
});
