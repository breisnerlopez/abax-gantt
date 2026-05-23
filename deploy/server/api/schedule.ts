import { assertCanManageNode, authenticate } from "./_shared/auth.ts";
import { getClient, type DbClient } from "./_shared/db.ts";
import { ApiError, handleCors, handleError, okResponse } from "./_shared/errors.ts";
import { optionalDate, readJson, routeId } from "./_shared/validation.ts";

async function propagateDatesToAncestors(db: DbClient, nodeId: string) {
  const node = await db.query<{ parent_id: string | null }>(`SELECT parent_id FROM wbs_nodes WHERE id = $1`, [nodeId]);
  let parentId = node.rows[0]?.parent_id ?? null;
  let safety = 0;
  while (parentId && safety < 20) {
    await db.query(
      `UPDATE wbs_nodes SET
         start_date = (SELECT MIN(start_date) FROM wbs_nodes WHERE parent_id = $1 AND start_date IS NOT NULL),
         end_date   = (SELECT MAX(end_date)   FROM wbs_nodes WHERE parent_id = $1 AND end_date IS NOT NULL),
         updated_at = now()
       WHERE id = $1 AND type IN ('project', 'stage', 'group')`,
      [parentId],
    );
    const parent = await db.query<{ parent_id: string | null }>(`SELECT id, parent_id FROM wbs_nodes WHERE id = $1`, [parentId]);
    if (parent.rows.length === 0) break;
    parentId = parent.rows[0].parent_id;
    safety++;
  }
}

type DateFields = { start_date: string | null; end_date: string | null };

function violates(type: string, p: DateFields, s: DateFields): boolean {
  if (!p.start_date || !p.end_date || !s.start_date || !s.end_date) return false;
  if (type === "FS") return p.end_date > s.start_date;
  if (type === "SS") return p.start_date > s.start_date;
  if (type === "FF") return p.end_date > s.end_date;
  if (type === "SF") return p.start_date > s.end_date;
  return false;
}

export async function handler(req: Request): Promise<Response> {
  const preflight = handleCors(req);
  if (preflight) return preflight;
  try {
    if (req.method !== "PATCH" && req.method !== "PUT") throw new ApiError(405, "Metodo no permitido");
    const auth = await authenticate(req);
    const db = getClient();
    const id = routeId(req, "api-wbs-schedule");
    await assertCanManageNode(auth.userId, id);

    const body = await readJson(req);
    const unschedule = body.unschedule === true;
    const patch: Record<string, unknown> = {};

    if (unschedule) {
      patch.start_date = null; patch.end_date = null; patch.is_unscheduled = true;
    } else {
      const sd = optionalDate(body.start_date, "start_date");
      if (!sd) throw new ApiError(400, "start_date requerido");
      patch.start_date = sd;
      patch.end_date = optionalDate(body.end_date, "end_date") ?? sd;
      patch.is_unscheduled = false;
    }

    const depsResult = await db.query<{id:string;predecessor_id:string;successor_id:string;type:string}>(
      `SELECT id, predecessor_id, successor_id, type FROM dependencies WHERE predecessor_id = $1 OR successor_id = $1`, [id]);
    const deps = depsResult.rows;
    if (deps.length > 0) {
      const relatedIds = [...new Set(deps.flatMap((d) => [d.predecessor_id, d.successor_id]))];
      const nodesResult = await db.query<{id:string;start_date:string|null;end_date:string|null}>(
        `SELECT id, start_date, end_date FROM wbs_nodes WHERE id = ANY($1)`, [relatedIds]);
      const dates = new Map<string, DateFields>();
      for (const n of nodesResult.rows) dates.set(n.id, { start_date: n.start_date, end_date: n.end_date });
      dates.set(id, { start_date: patch.start_date as string|null, end_date: patch.end_date as string|null });
      const conflict = deps.find((d) => violates(d.type, dates.get(d.predecessor_id)!, dates.get(d.successor_id)!));
      if (conflict) {
        return okResponse({ data: null, warnings: [{ code: "DEPENDENCY_VIOLATION", message: `La nueva fecha viola una dependencia ${conflict.type}`, dependency_id: conflict.id }] }, 409);
      }
    }

    await db.query(`UPDATE wbs_nodes SET start_date=$1, end_date=$2, is_unscheduled=$3, updated_at=now() WHERE id=$4`,
      [patch.start_date, patch.end_date, patch.is_unscheduled, id]);
    await propagateDatesToAncestors(db, id);
    const result = await db.query(`SELECT * FROM wbs_nodes WHERE id = $1`, [id]);
    return okResponse({ data: result.rows[0] });
  } catch (error) {
    return handleError(error);
  }
}
