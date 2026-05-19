import { authenticate } from "./_shared/auth.ts";
import { getClient } from "./_shared/db.ts";
import { ApiError, handleCors, handleError, okResponse } from "./_shared/errors.ts";
import { optionalString, readJson, requireString } from "./_shared/validation.ts";

export async function handler(req: Request): Promise<Response> {
  const preflight = handleCors(req);
  if (preflight) return preflight;
  try {
    const auth = await authenticate(req);
    if (!auth.isAdmin) throw new ApiError(403, "Solo administradores");
    const db = getClient();
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const last = pathParts[pathParts.length - 1];
    const isSingle = /^[0-9a-f-]{36}$/i.test(last);

    if (req.method === "GET") {
      const r = await db.query(`SELECT * FROM project_types ORDER BY name`);
      return okResponse({ data: r.rows, count: r.rows.length });
    }
    if (req.method === "POST") {
      const body = await readJson(req);
      const id = crypto.randomUUID();
      await db.query(`INSERT INTO project_types (id, name, description, color) VALUES ($1,$2,$3,$4)`, [id, requireString(body.name,"name"), optionalString(body.description,"description"), String(body.color || "#6366f1")]);
      const r = await db.query(`SELECT * FROM project_types WHERE id = $1`, [id]);
      return okResponse({ data: r.rows[0] }, 201);
    }
    if ((req.method === "PUT" || req.method === "PATCH") && isSingle) {
      const body = await readJson(req);
      const fields = ["name","description","color","is_active"];
      const patch: Record<string,unknown> = {};
      for (const f of fields) { if (body[f] !== undefined) patch[f] = body[f]; }
      if (Object.keys(patch).length === 0) throw new ApiError(400, "No hay cambios");
      const entries = Object.entries(patch);
      const sc = entries.map(([k],i) => `${k}=$${i+1}`);
      await db.query(`UPDATE project_types SET ${sc.join(",")} WHERE id=$${entries.length+1}`, [...entries.map(([,v])=>v), last]);
      const r = await db.query(`SELECT * FROM project_types WHERE id = $1`, [last]);
      return okResponse({ data: r.rows[0] });
    }

    throw new ApiError(405, "Metodo no permitido");
  } catch (error) {
    return handleError(error);
  }
}
