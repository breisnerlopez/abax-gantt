import { assertCanManageProject, authenticate } from "./_shared/auth.ts";
import { getClient } from "./_shared/db.ts";
import { ApiError, handleCors, handleError, okResponse } from "./_shared/errors.ts";
import { requireUuid } from "./_shared/validation.ts";

const STORAGE = Deno.env.get("STORAGE_PATH") || "./data/attachments";
const MAX_SIZE = 5 * 1024 * 1024;

export async function handler(req: Request): Promise<Response> {
  const preflight = handleCors(req);
  if (preflight) return preflight;
  try {
    const auth = await authenticate(req);
    const db = getClient();
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const last = pathParts[pathParts.length - 1];
    const isDelete = /^[0-9a-f-]{36}$/i.test(last);

    if (req.method === "GET") {
      const projectId = url.searchParams.get("project_id");
      if (!projectId) throw new ApiError(400, "project_id requerido");
      const r = await db.query(`SELECT * FROM attachments WHERE project_id = $1 ORDER BY created_at DESC`, [projectId]);
      return okResponse({ data: r.rows, count: r.rows.length });
    }

    if (req.method === "POST") {
      const form = await req.formData();
      const projectId = requireUuid(form.get("project_id"), "project_id");
      await assertCanManageProject(auth.userId, projectId);

      const {rows:[count]} = await db.query<{c:string}>(
        `SELECT COUNT(*)::text AS c FROM attachments WHERE project_id = $1`, [projectId]);
      if (parseInt(count.c) >= 5) throw new ApiError(400, "Maximo 5 archivos por proyecto");

      const file = form.get("file");
      if (!(file instanceof File)) throw new ApiError(400, "Archivo requerido");
      if (file.size > MAX_SIZE) throw new ApiError(400, "Archivo mayor a 5 MB");
      if (file.size === 0) throw new ApiError(400, "Archivo vacio");

      const ext = file.name.includes(".") ? file.name.split(".").pop()?.toLowerCase() : "";
      const allowed = ["pdf","png","jpg","jpeg","gif","svg","doc","docx","xls","xlsx","csv","txt"];
      if (!ext || !allowed.includes(ext)) throw new ApiError(400, `Tipo no permitido: .${ext}`);

      const id = crypto.randomUUID();
      const filename = `${id}.${ext}`;
      const dir = `${STORAGE}/${projectId}`;
      Deno.mkdirSync(dir, { recursive: true });
      await Deno.writeFile(`${dir}/${filename}`, new Uint8Array(await file.arrayBuffer()));

      await db.query(
        `INSERT INTO attachments (id, project_id, file_name, file_path, file_size, mime_type, uploaded_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [id, projectId, file.name, `${projectId}/${filename}`, file.size, file.type || "application/octet-stream", auth.userId],
      );
      const r = await db.query(`SELECT * FROM attachments WHERE id = $1`, [id]);
      return okResponse({ data: r.rows[0] }, 201);
    }

    if (req.method === "DELETE" && isDelete) {
      const {rows: [att]} = await db.query<{file_path:string;project_id:string}>(`SELECT file_path, project_id FROM attachments WHERE id = $1`, [last]);
      if (!att) throw new ApiError(404, "Adjunto no encontrado");
      await assertCanManageProject(auth.userId, att.project_id);
      try { Deno.removeSync(`${STORAGE}/${att.file_path}`); } catch { /* ignore */ }
      await db.query(`DELETE FROM attachments WHERE id = $1`, [last]);
      return okResponse({ data: { deleted: true } });
    }

    throw new ApiError(405, "Metodo no permitido");
  } catch (error) {
    return handleError(error);
  }
}
