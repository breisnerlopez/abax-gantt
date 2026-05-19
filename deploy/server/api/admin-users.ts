import { authenticate } from "./_shared/auth.ts";
import { getClient } from "./_shared/db.ts";
import { ApiError, handleCors, handleError, okResponse } from "./_shared/errors.ts";
import { optionalString, optionalUuid, readJson, requireString } from "./_shared/validation.ts";

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
      if (isSingle) {
        const r = await db.query(`SELECT id, email, full_name, avatar_url, status, is_admin, authentik_sub, created_at, updated_at FROM profiles WHERE id = $1`, [last]);
        if (r.rows.length === 0) throw new ApiError(404, "Usuario no encontrado");
        return okResponse({ data: r.rows[0] });
      }
      const r = await db.query(`SELECT id, email, full_name, avatar_url, status, is_admin, authentik_sub, created_at, updated_at FROM profiles ORDER BY full_name`);
      return okResponse({ data: r.rows, count: r.rows.length });
    }

    if (req.method === "POST") {
      const body = await readJson(req);
      const email = requireString(body.email, "email").toLowerCase();
      const fullName = requireString(body.full_name, "full_name") || email;
      const id = crypto.randomUUID();
      const placeholderSub = `invited:${email}`;
      await db.query(
        `INSERT INTO profiles (id, email, full_name, status, is_admin, avatar_url, authentik_sub)
         VALUES ($1,$2,$3,'invited',false,$4,$5)
         ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name`,
        [id, email, fullName, optionalString(body.avatar_url, "avatar_url", 1000), placeholderSub],
      );
      const r = await db.query(`SELECT * FROM profiles WHERE email = $1`, [email]);
      return okResponse({ data: r.rows[0] }, 201);
    }

    if ((req.method === "PUT" || req.method === "PATCH") && isSingle) {
      const body = await readJson(req);
      const fields = ["email","full_name","status","is_admin","avatar_url","authentik_sub"];
      const patch: Record<string,unknown> = {};
      for (const f of fields) { if (body[f] !== undefined) patch[f] = body[f]; }
      if (Object.keys(patch).length === 0) throw new ApiError(400, "No hay cambios");
      const entries = Object.entries(patch);
      const setClauses = entries.map(([k],i) => `${k}=$${i+1}`);
      await db.query(`UPDATE profiles SET ${setClauses.join(",")}, updated_at=now() WHERE id=$${entries.length+1}`, [...entries.map(([,v])=>v), last]);
      const r = await db.query(`SELECT * FROM profiles WHERE id = $1`, [last]);
      return okResponse({ data: r.rows[0] });
    }

    throw new ApiError(405, "Metodo no permitido");
  } catch (error) {
    return handleError(error);
  }
}
