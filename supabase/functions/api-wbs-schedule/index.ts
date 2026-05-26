import { assertCanManageNode, authenticate } from "../_shared/auth.ts";
import { handleCors } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/db.ts";
import { ApiError, handleError, okResponse } from "../_shared/errors.ts";
import { optionalDate, readJson, routeId } from "../_shared/validation.ts";

type DateFields = { start_date: string | null; end_date: string | null };
type DependencyRow = { id: string; predecessor_id: string; successor_id: string; type: string };

function violatesDependency(type: string, predecessor: DateFields, successor: DateFields): boolean {
  if (!predecessor.start_date || !predecessor.end_date || !successor.start_date || !successor.end_date) return false;
  if (type === "FS") return predecessor.end_date > successor.start_date;
  if (type === "SS") return predecessor.start_date > successor.start_date;
  if (type === "FF") return predecessor.end_date > successor.end_date;
  if (type === "SF") return predecessor.start_date > successor.end_date;
  return false;
}

Deno.serve(async (req: Request) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    if (req.method !== "PATCH" && req.method !== "PUT") throw new ApiError(405, "Metodo no permitido");

    const auth = await authenticate(req);
    const db = getServiceClient();
    const id = routeId(req, "api-wbs-schedule");
    await assertCanManageNode(auth.userId, id);

    const body = await readJson(req);
    const unschedule = body.unschedule === true;
    const patch: Record<string, unknown> = {};

    if (unschedule) {
      patch.start_date = null;
      patch.end_date = null;
      patch.is_unscheduled = true;
    } else {
      const startDate = optionalDate(body.start_date, "start_date");
      const endDate = optionalDate(body.end_date, "end_date") ?? startDate;
      if (!startDate) throw new ApiError(400, "start_date es requerido para programar");
      patch.start_date = startDate;
      patch.end_date = endDate;
      patch.is_unscheduled = false;
    }

    const { data: dependencies, error: depError } = await db
      .from("dependencies")
      .select("id, predecessor_id, successor_id, type")
      .or(`predecessor_id.eq.${id},successor_id.eq.${id}`);
    if (depError) throw new ApiError(500, depError.message);

    const relatedIds = [...new Set((dependencies ?? []).flatMap((dep: DependencyRow) => [dep.predecessor_id, dep.successor_id]))];
    if (relatedIds.length > 0) {
      const { data: relatedNodes, error: relatedError } = await db
        .from("wbs_nodes")
        .select("id, start_date, end_date")
        .in("id", relatedIds);
      if (relatedError) throw new ApiError(500, relatedError.message);

      const dates = new Map<string, DateFields>();
      for (const node of relatedNodes ?? []) {
        dates.set(node.id, { start_date: node.start_date, end_date: node.end_date });
      }
      dates.set(id, {
        start_date: (patch.start_date as string | null),
        end_date: (patch.end_date as string | null),
      });

      const conflict = (dependencies ?? []).find((dep: DependencyRow) => {
        const predecessor = dates.get(dep.predecessor_id);
        const successor = dates.get(dep.successor_id);
        return predecessor && successor && violatesDependency(dep.type, predecessor, successor);
      });
      if (conflict) {
        return okResponse({
          data: null,
          warnings: [{
            code: "DEPENDENCY_VIOLATION",
            message: `La nueva fecha viola una dependencia ${conflict.type}`,
            dependency_id: conflict.id,
          }],
        }, 409);
      }
    }

    const { data, error } = await db.from("wbs_nodes").update(patch).eq("id", id).select().single();
    if (error) throw new ApiError(400, error.message);

    // Devolvemos los ancestros recalculados por el trigger rollup en la misma
    // response para que el cliente actualice los padres sin hacer refetch full.
    let ancestors: unknown[] = [];
    if (data?.path) {
      const { data: ancestorRows } = await db
        .rpc("get_ancestor_nodes", { node_path: data.path, exclude_id: id });
      if (Array.isArray(ancestorRows)) ancestors = ancestorRows;
    }
    return okResponse({ data, ancestors });
  } catch (error) {
    return handleError(error);
  }
});
