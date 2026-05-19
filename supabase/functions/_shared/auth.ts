import { createLocalJWKSet, createRemoteJWKSet, jwtVerify } from "npm:jose";
import { ApiError } from "./errors.ts";
import { getServiceClient } from "./db.ts";

export interface AuthContext {
  userId: string;
  authentikSub: string;
  email: string;
  groups: string[];
  isAdmin: boolean;
}

// JWKS de prueba para desarrollo local (key ES256)
const QA_JWKS = {
  keys: [{ kty: "EC", crv: "P-256", x: "lrqyhkgsaYLSddo-0wgQCXfWORQh2AISvFB3Rm7tQIY", y: "kL-iLwKTwQWxpNAJrZHc8QRHG7jMNdiYzqQN-61XeYE", alg: "ES256", use: "sig", kid: "qa-test-key-01" }],
};

let _jwks: ReturnType<typeof createRemoteJWKSet> | ReturnType<typeof createLocalJWKSet> | null = null;

function getJwks() {
  if (!_jwks) {
    const jwksUrl = Deno.env.get("AUTHENTIK_JWKS_URL");
    if (jwksUrl) {
      _jwks = createRemoteJWKSet(new URL(jwksUrl));
    } else {
      _jwks = createLocalJWKSet(QA_JWKS);
    }
  }
  return _jwks;
}

export async function authenticate(req: Request): Promise<AuthContext> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new ApiError(401, "Token requerido");
  const token = authHeader.slice("Bearer ".length);
  const issuer = Deno.env.get("AUTHENTIK_ISSUER") ?? "https://qa-authentik.local/application/o/abax-gantt/";
  const audience = Deno.env.get("AUTHENTIK_CLIENT_ID") ?? "abax-gantt";
  const jwks = getJwks();
  let payload;
  try { const r = await jwtVerify(token, jwks, { issuer, audience }); payload = r.payload; }
  catch(e) { throw new ApiError(401, `Token invalido: ${e instanceof Error ? e.message : "desconocido"}`); }
  const authentikSub = String(payload.sub ?? "");
  const email = String(payload.email ?? "");
  const groups: string[] = Array.isArray(payload.groups) ? payload.groups.map(String) : [];
  const db = getServiceClient();
  const { data: profile } = await db.from("profiles").select("id, is_admin, status").eq("authentik_sub", authentikSub).single();
  if (!profile) {
    const { data: newProfile } = await db.from("profiles").upsert({
      authentik_sub: authentikSub, email,
      full_name: String(payload.name ?? payload.preferred_username ?? email.split("@")[0] ?? "Usuario"),
      status: "active",
      is_admin: groups.includes(Deno.env.get("AUTHENTIK_ADMIN_GROUP") ?? "abax-admins"),
    }, { onConflict: "authentik_sub" }).select("id, is_admin, status").single();
    if (!newProfile) throw new ApiError(500, "No se pudo crear perfil");
    await db.rpc("set_user_context", { user_id: newProfile.id });
    return { userId: newProfile.id, authentikSub, email, groups, isAdmin: Boolean(newProfile.is_admin) };
  }
  if (profile.status !== "active") throw new ApiError(403, "Usuario inactivo");
  const adminGroup = Deno.env.get("AUTHENTIK_ADMIN_GROUP") ?? "abax-admins";
  const isAdmin = Boolean(profile.is_admin) || groups.includes(adminGroup);
  if (isAdmin !== Boolean(profile.is_admin)) {
    await db.from("profiles").update({ is_admin: isAdmin }).eq("id", profile.id);
  }
  await db.rpc("set_user_context", { user_id: profile.id });
  return { userId: profile.id, authentikSub, email, groups, isAdmin };
}

export async function assertCanManageProject(userId: string, projectId: string): Promise<void> {
  const db = getServiceClient();
  const { data, error } = await db.rpc("can_manage_project", { check_user_id: userId, check_project_id: projectId });
  if (error) throw new ApiError(500, error.message);
  if (!data) throw new ApiError(403, "Sin permiso sobre el proyecto");
}
export async function assertCanManageNode(userId: string, nodeId: string): Promise<void> {
  const db = getServiceClient();
  const { data, error } = await db.rpc("can_manage_node", { check_user_id: userId, node_id: nodeId });
  if (error) throw new ApiError(500, error.message);
  if (!data) throw new ApiError(403, "Sin permiso sobre el nodo");
}
export async function assertCanManageDependency(userId: string, predecessorId: string, successorId: string): Promise<void> {
  const db = getServiceClient();
  const { data, error } = await db.rpc("can_manage_dependency", { check_user_id: userId, predecessor: predecessorId, successor: successorId });
  if (error) throw new ApiError(500, error.message);
  if (!data) throw new ApiError(403, "Sin permiso para gestionar la dependencia");
}
export function assertAdmin(auth: AuthContext): void { if (!auth.isAdmin) throw new ApiError(403, "Requiere permisos de administrador"); }
export async function assertCanReportProgress(userId: string, nodeId: string): Promise<void> {
  const db = getServiceClient();
  const { data: canManage } = await db.rpc("can_manage_node", { check_user_id: userId, node_id: nodeId });
  if (canManage) return;
  const { data: assignment } = await db.from("task_assignees").select("id").eq("task_id", nodeId).eq("user_id", userId).maybeSingle();
  if (!assignment) throw new ApiError(403, "Sin permiso para reportar avance");
}
export async function assertAssignedToTask(userId: string, nodeId: string): Promise<void> {
  const db = getServiceClient();
  const { data } = await db.from("task_assignees").select("id").eq("task_id", nodeId).eq("user_id", userId).maybeSingle();
  if (!data) throw new ApiError(403, "Solo un ejecutor asignado puede registrar horas");
}
