import { createRemoteJWKSet, jwtVerify } from "npm:jose@5";
import { getClient } from "./db.ts";
import { ApiError } from "./errors.ts";

export interface AuthContext {
  userId: string;
  authentikSub: string;
  email: string;
  groups: string[];
  isAdmin: boolean;
}

const ISSUER = Deno.env.get("AUTHENTIK_ISSUER")!;
const CLIENT_ID = Deno.env.get("AUTHENTIK_CLIENT_ID")!;
const JWKS_URL = Deno.env.get("AUTHENTIK_JWKS_URL")!;
const ADMIN_GROUP = Deno.env.get("ADMIN_GROUP") || "abax-admins";

const getJwks = () => createRemoteJWKSet(new URL(JWKS_URL));

export async function authenticate(req: Request): Promise<AuthContext> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new ApiError(401, "Token requerido");
  }

  const token = authHeader.slice(7);
  const jwks = getJwks();

  let payload: Record<string, unknown>;
  try {
    const result = await jwtVerify(token, jwks, {
      issuer: ISSUER,
      audience: CLIENT_ID,
    });
    payload = result.payload;
  } catch (err) {
    console.error("[auth] JWT verification failed:", (err as Error).message);
    console.error("[auth] Issuer expected:", ISSUER);
    console.error("[auth] Audience expected:", CLIENT_ID);
    console.error("[auth] Token header:", token.substring(0, 50) + "...");
    throw new ApiError(401, "Token invalido");
  }

  const authentikSub = String(payload.sub ?? "");
  const email = String(payload.email ?? "");
  const groups = Array.isArray(payload.groups) ? payload.groups.map(String) : [];

  const db = getClient();
  const result = await db.query<{
    id: string;
    is_admin: boolean;
    status: string;
  }>(
    `SELECT id, is_admin, status FROM profiles WHERE authentik_sub = $1`,
    [authentikSub],
  );

  const isAdminByGroup = groups.includes(ADMIN_GROUP);
  if (result.rows.length === 0) {
    // Si existe una invitación previa con email y placeholder sub, vincularla con el sub real
    const linked = await db.query<{ id: string; is_admin: boolean }>(
      `UPDATE profiles
         SET authentik_sub = $1,
             status = 'active',
             full_name = COALESCE(NULLIF(full_name, ''), $3),
             is_admin = is_admin OR $4
       WHERE email = $2 AND authentik_sub LIKE 'invited:%'
       RETURNING id, is_admin`,
      [authentikSub, email, payload.name || email, isAdminByGroup],
    );
    if (linked.rows.length > 0) {
      return {
        userId: linked.rows[0].id,
        authentikSub,
        email,
        groups,
        isAdmin: linked.rows[0].is_admin,
      };
    }
    const insert = await db.query<{ id: string; is_admin: boolean }>(
      `INSERT INTO profiles (authentik_sub, email, full_name, is_admin, status)
       VALUES ($1, $2, $3, $4, 'active')
       ON CONFLICT (authentik_sub) DO UPDATE SET email = $2, full_name = $3
       RETURNING id, is_admin`,
      [authentikSub, email, payload.name || email, isAdminByGroup],
    );
    return {
      userId: insert.rows[0].id,
      authentikSub,
      email,
      groups,
      isAdmin: insert.rows[0].is_admin,
    };
  }

  const profile = result.rows[0];
  if (profile.status !== "active") throw new ApiError(403, "Usuario inactivo");

  // Mantener is_admin sincronizado con membresía del grupo en Authentik
  if (isAdminByGroup !== profile.is_admin) {
    await db.query(`UPDATE profiles SET is_admin = $1 WHERE id = $2`, [isAdminByGroup, profile.id]);
    profile.is_admin = isAdminByGroup;
  }

  return {
    userId: profile.id,
    authentikSub,
    email,
    groups,
    isAdmin: profile.is_admin,
  };
}

export async function assertCanManageNode(userId: string, nodeId: string): Promise<void> {
  const db = getClient();
  const result = await db.query<{ can_manage: boolean }>(
    `SELECT can_manage_node($1, $2) AS can_manage`,
    [userId, nodeId],
  );
  if (!result.rows[0]?.can_manage) {
    throw new ApiError(403, "Sin permiso sobre el nodo");
  }
}

export async function assertCanManageProject(userId: string, projectId: string): Promise<void> {
  const db = getClient();
  const result = await db.query<{ can_manage: boolean }>(
    `SELECT can_manage_project($1, $2) AS can_manage`,
    [userId, projectId],
  );
  if (!result.rows[0]?.can_manage) {
    throw new ApiError(403, "Sin permiso sobre el proyecto");
  }
}

export function assertAdmin(auth: AuthContext): void {
  if (!auth.isAdmin) throw new ApiError(403, "Requiere permisos de administrador");
}

export async function assertCanReportProgress(userId: string, nodeId: string): Promise<void> {
  const db = getClient();
  const can = await db.query<{ can_manage: boolean }>(
    `SELECT can_manage_node($1, $2) AS can_manage`,
    [userId, nodeId],
  );
  if (can.rows[0]?.can_manage) return;
  const assigned = await db.query<{ id: string }>(
    `SELECT id FROM task_assignees WHERE task_id = $1 AND user_id = $2 LIMIT 1`,
    [nodeId, userId],
  );
  if (assigned.rows.length === 0) {
    throw new ApiError(403, "Sin permiso para reportar avance");
  }
}

export async function assertAssignedToTask(userId: string, nodeId: string): Promise<void> {
  const db = getClient();
  const can = await db.query<{ can_manage: boolean }>(
    `SELECT can_manage_node($1, $2) AS can_manage`,
    [userId, nodeId],
  );
  if (can.rows[0]?.can_manage) return;
  const assigned = await db.query<{ id: string }>(
    `SELECT id FROM task_assignees WHERE task_id = $1 AND user_id = $2 LIMIT 1`,
    [nodeId, userId],
  );
  if (assigned.rows.length === 0) {
    throw new ApiError(403, "Solo un ejecutor asignado o responsable puede operar sobre esta tarea");
  }
}

export async function assertCanManageDependency(userId: string, predecessorId: string, successorId: string): Promise<void> {
  const db = getClient();
  const result = await db.query<{ predecessor_project: string; successor_project: string }>(
    `SELECT
       (SELECT project_id::text FROM wbs_nodes WHERE id = $1) AS predecessor_project,
       (SELECT project_id::text FROM wbs_nodes WHERE id = $2) AS successor_project`,
    [predecessorId, successorId],
  );
  const row = result.rows[0];
  if (!row?.predecessor_project || !row?.successor_project) {
    throw new ApiError(404, "Predecesor o sucesor no encontrado");
  }
  if (row.predecessor_project !== row.successor_project) {
    throw new ApiError(400, "Predecesor y sucesor deben pertenecer al mismo proyecto");
  }
  const can = await db.query<{ can_manage: boolean }>(
    `SELECT can_manage_node($1, $2) AS can_manage`,
    [userId, successorId],
  );
  if (!can.rows[0]?.can_manage) {
    throw new ApiError(403, "Sin permiso para gestionar la dependencia");
  }
}
