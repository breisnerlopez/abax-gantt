import { assertCanManageNode, authenticate } from "./_shared/auth.ts";
import { getClient } from "./_shared/db.ts";
import { ApiError, handleCors, handleError, okResponse } from "./_shared/errors.ts";
import { optionalNumber, optionalUuid, readJson, routeId } from "./_shared/validation.ts";

export async function handler(req: Request): Promise<Response> {
  const preflight = handleCors(req);
  if (preflight) return preflight;
  try {
    if (req.method !== "PATCH" && req.method !== "PUT") throw new ApiError(405, "Metodo no permitido");
    const auth = await authenticate(req);
    const db = getClient();
    const id = routeId(req, "api-wbs-move");
    const body = await readJson(req);

    const {rows: [node]} = await db.query<{id:string;parent_id:string;project_id:string;path:string;type:string;name:string}>(
      `SELECT id, parent_id, project_id, path, type, name FROM wbs_nodes WHERE id = $1`, [id]);
    if (!node) throw new ApiError(404, "Nodo no encontrado");
    await assertCanManageNode(auth.userId, id);

    const newParentId = optionalUuid(body.parent_id, "parent_id");
    const newSortOrder = optionalNumber(body.sort_order, "sort_order");
    let targetProjectId = node.project_id;
    let parentPath = "";

    if (newParentId !== null && newParentId !== node.parent_id) {
      if (newParentId === id) throw new ApiError(400, "Un nodo no puede ser padre de si mismo");
      const {rows: [parent]} = await db.query<{id:string;project_id:string;path:string;type:string}>(
        `SELECT id, project_id, path, type FROM wbs_nodes WHERE id = $1`, [newParentId]);
      if (!parent) throw new ApiError(404, "Nodo padre no encontrado");
      await assertCanManageNode(auth.userId, newParentId);
      targetProjectId = parent.project_id;
      parentPath = parent.path;

      if (targetProjectId !== node.project_id) {
        const {rows: [dep]} = await db.query<{id:string}>(
          `SELECT id FROM dependencies WHERE predecessor_id = $1 OR successor_id = $1 LIMIT 1`, [id]);
        if (dep) return okResponse({ data: null, warnings: [{ code: "DEPENDENCY_VIOLATION", message: "No se puede mover a otro proyecto con dependencias existentes", dependency_id: dep.id }] }, 409);
      }

      const descendants = await db.query<{id:string}>(
        `SELECT id FROM wbs_nodes WHERE id != $1 AND path <@ $2`, [id, `ltree('${node.path}')`]);
      if (descendants.rows.some((d:{id:string}) => d.id === newParentId)) {
        throw new ApiError(400, "No se puede mover un nodo debajo de uno de sus descendientes");
      }
    }

    const patch: Record<string, unknown> = {};
    if (newParentId !== null && newParentId !== node.parent_id) { patch.parent_id = newParentId; patch.project_id = targetProjectId; }
    if (newSortOrder !== null) patch.sort_order = newSortOrder;
    if (Object.keys(patch).length === 0) throw new ApiError(400, "No hay cambios");
    const entries = Object.entries(patch);
    const setClauses = entries.map(([k],i) => `${k}=$${i+1}`);
    await db.query(`UPDATE wbs_nodes SET ${setClauses.join(",")}, updated_at=now() WHERE id=$${entries.length+1}`, [...entries.map(([,v])=>v), id]);

    if (newParentId !== null && newParentId !== node.parent_id) {
      const newPathLabel = `n_${id.replaceAll("-","_")}`;
      const newPath = parentPath ? `${parentPath}.${newPathLabel}` : newPathLabel;
      await db.query(`UPDATE wbs_nodes SET path=$1 WHERE id=$2`, [newPath, id]);
      // update children paths
      const children = await db.query<{id:string;path:string}>(`SELECT id, path FROM wbs_nodes WHERE path <@ $1 AND id != $2 LIMIT 100`, [`ltree('${node.path}')`, id]);
      for (const child of children.rows) {
        const suffix = child.path.replace(node.path, "");
        await db.query(`UPDATE wbs_nodes SET path=$1 WHERE id=$2`, [`${newPath}${suffix}`, child.id]);
      }
    }

    const result = await db.query(`SELECT * FROM wbs_nodes WHERE id = $1`, [id]);
    return okResponse({ data: result.rows[0] });
  } catch (error) {
    return handleError(error);
  }
}
