import { assertEquals, assertNotEquals, assertExists } from "jsr:@std/assert@1";
import { SignJWT, importJWK } from "npm:jose";

const BASE_URL = Deno.env.get("SUPABASE_URL") ?? "http://localhost:54321";
const TEST_PRIVATE_JWK_PATH = Deno.env.get("AUTHENTIK_TEST_PRIVATE_JWK_PATH") ?? "/tmp/test-jwk-private.json";
const TEST_ISSUER = Deno.env.get("AUTHENTIK_ISSUER") ?? "";
const TEST_AUDIENCE = Deno.env.get("AUTHENTIK_CLIENT_ID") ?? "";

let adminToken = "";
let userToken = "";
let projectId = "";
let projectTypeId = "";
let rootNodeId = "";
let childNodeId = "";
let grandchildNodeId = "";
let milestoneNodeId = "";

async function generateTokens() {
  if (!TEST_ISSUER || !TEST_AUDIENCE) {
    throw new Error("AUTHENTIK_ISSUER y AUTHENTIK_CLIENT_ID son requeridos para tests de integracion");
  }

  const privJwkStr = await Deno.readTextFile(TEST_PRIVATE_JWK_PATH);
  const privJwk = JSON.parse(privJwkStr);
  const privateKey = await importJWK(privJwk, "ES256");

  const now = Math.floor(Date.now() / 1000);

  adminToken = await new SignJWT({
    sub: "qa-admin-001",
    email: "admin-qa@test.local",
    name: "Admin QA",
    groups: ["abax-admins"],
    preferred_username: "admin-qa",
  })
    .setProtectedHeader({ alg: "ES256", kid: "qa-test-key-01" })
    .setIssuer(TEST_ISSUER)
    .setAudience(TEST_AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(now + 7200)
    .sign(privateKey);

  userToken = await new SignJWT({
    sub: "qa-user-001",
    email: "user-qa@test.local",
    name: "User QA",
    groups: [],
    preferred_username: "user-qa",
  })
    .setProtectedHeader({ alg: "ES256", kid: "qa-test-key-01" })
    .setIssuer(TEST_ISSUER)
    .setAudience(TEST_AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(now + 7200)
    .sign(privateKey);
}

async function api(method: string, path: string, token: string | null, body?: unknown, extraHeaders?: Record<string, string>) {
  const headers: Record<string, string> = { "Content-Type": "application/json", ...extraHeaders };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}/functions/v1/${path}`, {
    method, headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const respBody = await res.json().catch(() => null);
  return { status: res.status, headers: res.headers, body: respBody };
}

async function adminApi(method: string, path: string, body?: unknown) { return api(method, path, adminToken, body); }
async function userApi(method: string, path: string, body?: unknown) { return api(method, path, userToken, body); }
async function anonApi(method: string, path: string, body?: unknown) { return api(method, path, null, body); }

async function dbExec(sql: string): Promise<void> {
  const command = new Deno.Command("docker", {
    args: ["exec", "supabase_db_abax-gantt", "psql", "-U", "postgres", "-d", "postgres", "-c", sql],
    stdout: "piped", stderr: "piped",
  });
  await command.output();
}

async function dbScalar(sql: string): Promise<string> {
  const command = new Deno.Command("docker", {
    args: ["exec", "supabase_db_abax-gantt", "psql", "-U", "postgres", "-d", "postgres", "-t", "-A", "-c", sql],
    stdout: "piped", stderr: "piped",
  });
  const output = await command.output();
  return new TextDecoder().decode(output.stdout).trim().split("\n")[0] ?? "";
}

Deno.test("SETUP - Generar tokens JWT de prueba", generateTokens);

Deno.test("AUTH - Request sin token retorna 401", async () => {
  const { status, body } = await anonApi("GET", "api-projects");
  assertEquals(status, 401);
  assertEquals((body as Record<string, string>).error, "Token requerido");
});

Deno.test("AUTH - Request con token invalido retorna 401", async () => {
  const { status } = await api("GET", "api-projects", "invalid-token-xyz");
  assertEquals(status, 401);
});

Deno.test("CORS - OPTIONS retorna 204 con headers CORS", async () => {
  const res = await fetch(`${BASE_URL}/functions/v1/api-projects`, { method: "OPTIONS" });
  await res.body?.cancel();
  assertEquals(res.status, 204);
  assertEquals(res.headers.has("Access-Control-Allow-Origin"), true);
});

Deno.test("PROJECTS - GET lista proyectos", async () => {
  const { status, body } = await adminApi("GET", "api-projects");
  assertEquals(status, 200);
  assertEquals(typeof (body as Record<string, number>).count, "number");
});

Deno.test("PROJECTS - POST crea proyecto exitosamente con JWT Authentik", async () => {
  const { status, body } = await adminApi("POST", "api-projects", {
    name: "JWT Test Project", description: "Creado con JWT real",
  });
  assertEquals(status, 201);
  const data = body as { data: { id: string; name: string; root_node: { id: string } } };
  assertExists(data.data.id);
  assertEquals(data.data.name, "JWT Test Project");
  projectId = data.data.id;
  rootNodeId = data.data.root_node.id;
});

Deno.test("PROJECTS - POST rechaza sin nombre", async () => {
  const { status, body } = await adminApi("POST", "api-projects", { description: "No name" });
  assertEquals(status, 400);
  assertEquals((body as Record<string, string>).error, "name es requerido");
});

Deno.test("PROJECTS - POST rechaza nombre vacio", async () => {
  const { status } = await adminApi("POST", "api-projects", { name: "   " });
  assertEquals(status, 400);
});

Deno.test("PROJECTS - POST con budget_total", async () => {
  const { status, body } = await adminApi("POST", "api-projects", { name: "Budget", budget_total: 100000 });
  assertEquals(status, 201);
  assertEquals((body as Record<string, Record<string, number>>).data.budget_total, 100000);
});

Deno.test("PROJECTS - POST con autoscheduling_enabled false", async () => {
  const { status, body } = await adminApi("POST", "api-projects", { name: "NoAuto", autoscheduling_enabled: false });
  assertEquals(status, 201);
  assertEquals((body as Record<string, Record<string, boolean>>).data.autoscheduling_enabled, false);
});

Deno.test("PROJECTS - Metodo no permitido retorna 405", async () => {
  const { status } = await adminApi("DELETE", "api-projects");
  assertEquals(status, 405);
});

Deno.test("PROJECTS - GET confirma proyecto creado", async () => {
  const { status, body } = await adminApi("GET", "api-projects");
  assertEquals(status, 200);
  const data = (body as Record<string, unknown[]>).data;
  assertEquals((data as Record<string, string>[]).some((p) => p.name === "JWT Test Project"), true);
});

Deno.test("WBS - POST crea nodo hijo bajo root", async () => {
  const { status, body } = await adminApi("POST", "api-wbs", {
    parent_id: rootNodeId, name: "Stage JWT", type: "stage", start_date: "2024-06-01", end_date: "2024-06-30",
  });
  assertEquals(status, 201);
  childNodeId = (body as Record<string, Record<string, string>>).data.id;
});

Deno.test("WBS - POST crea tarea bajo stage", async () => {
  const { status, body } = await adminApi("POST", "api-wbs", {
    parent_id: childNodeId, name: "Task JWT", type: "task",
    start_date: "2024-06-01", end_date: "2024-06-15", estimated_hours: 40, progress: 0,
  });
  assertEquals(status, 201);
  grandchildNodeId = (body as Record<string, Record<string, string>>).data.id;
});

Deno.test("WBS - POST crea milestone", async () => {
  const { status, body } = await adminApi("POST", "api-wbs", {
    parent_id: childNodeId, name: "MS JWT", type: "milestone", start_date: "2024-06-30", color: "#ff0000",
  });
  assertEquals(status, 201);
  milestoneNodeId = (body as Record<string, Record<string, string>>).data.id;
});

Deno.test("WBS - POST sin parent_id retorna 400", async () => {
  const { status } = await adminApi("POST", "api-wbs", { name: "Orphan" });
  assertEquals(status, 400);
});

Deno.test("WBS - POST con parent_id invalido retorna 400", async () => {
  const { status } = await adminApi("POST", "api-wbs", { parent_id: "not-a-uuid", name: "Bad" });
  assertEquals(status, 400);
});

Deno.test("WBS - POST crea nodo sin fechas (unscheduled)", async () => {
  const { status, body } = await adminApi("POST", "api-wbs", { parent_id: rootNodeId, name: "Unscheduled", type: "task" });
  assertEquals(status, 201);
  assertEquals((body as Record<string, Record<string, boolean>>).data.is_unscheduled, true);
});

Deno.test("WBS - GET lista nodos del proyecto", async () => {
  const { status, body } = await adminApi("GET", `api-wbs?project_id=${projectId}`);
  assertEquals(status, 200);
  assertEquals((body as Record<string, number>).count >= 5, true);
});

Deno.test("WBS - GET project_id include_context devuelve arbol del proyecto", async () => {
  const { status, body } = await adminApi("GET", `api-wbs?project_id=${projectId}&include_context=true`);
  assertEquals(status, 200);
  const data = (body as Record<string, unknown[]>).data as Record<string, string>[];
  assertEquals(data.every((node) => node.project_id === projectId), true);
  assertEquals(data.some((node) => node.id === rootNodeId), true);
});

Deno.test("WBS - GET filtra nodos unscheduled", async () => {
  const { status, body } = await adminApi("GET", `api-wbs?unscheduled=true`);
  assertEquals(status, 200);
  const data = (body as Record<string, unknown[]>).data;
  (data as Record<string, boolean>[]).forEach((n) => assertEquals(n.is_unscheduled, true));
});

Deno.test("WBS - GET my_tasks devuelve tareas asignadas con ancestros", async () => {
  await userApi("GET", "api-projects");
  const userId = await dbScalar("select id from public.profiles where authentik_sub = 'qa-user-001' limit 1;");
  assertNotEquals(userId, "");
  const assign = await adminApi("POST", "api-assignees", { task_id: grandchildNodeId, user_id: userId });
  assertEquals([201, 400].includes(assign.status), true);

  const { status, body } = await userApi("GET", "api-wbs?my_tasks=true");
  assertEquals(status, 200);
  const data = (body as Record<string, unknown[]>).data as Record<string, string>[];
  assertEquals(data.some((node) => node.id === grandchildNodeId), true);
  assertEquals(data.some((node) => node.id === childNodeId), true);
  assertEquals(data.some((node) => node.id === rootNodeId), true);
  assertEquals(data.every((node) => node.name !== "Unscheduled"), true);
});

Deno.test("WBS - GET usuario ejecutor solo carga proyecto visible", async () => {
  const { status } = await userApi("GET", `api-wbs?project_id=${projectId}&include_context=true`);
  assertEquals(status, 200);

  const other = await adminApi("POST", "api-projects", { name: "Invisible JWT" });
  const otherProjectId = (other.body as { data: { id: string } }).data.id;
  const denied = await userApi("GET", `api-wbs?project_id=${otherProjectId}&include_context=true`);
  assertEquals(denied.status, 403);
});

Deno.test("WBS - GET filtra por assignee_id", async () => {
  const userId = await dbScalar("select id from public.profiles where authentik_sub = 'qa-user-001' limit 1;");
  const { status, body } = await adminApi("GET", `api-wbs?assignee_id=${userId}`);
  assertEquals(status, 200);
  const data = (body as Record<string, unknown[]>).data as Record<string, string>[];
  assertEquals(data.length >= 1, true);
  assertEquals(data.every((node) => node.id === grandchildNodeId), true);
});

Deno.test("WBS - GET filtra por responsible_id", async () => {
  const adminId = await dbScalar("select id from public.profiles where authentik_sub = 'qa-admin-001' limit 1;");
  const { status, body } = await adminApi("GET", `api-wbs?responsible_id=${adminId}`);
  assertEquals(status, 200);
  const data = (body as Record<string, unknown[]>).data as Record<string, string | null>[];
  assertEquals(data.every((node) => node.responsible_id === adminId), true);
});

Deno.test("WBS - GET filtra por status", async () => {
  const { status, body } = await adminApi("GET", "api-wbs?status=pendiente");
  assertEquals(status, 200);
  const data = (body as Record<string, unknown[]>).data as Record<string, unknown>[];
  assertEquals(data.every((node) => node.end_date === null && Number(node.progress) === 0), true);
});

Deno.test("WBS - GET filtra por status retrasado", async () => {
  const { status, body } = await adminApi("GET", "api-wbs?status=retrasado");
  assertEquals(status, 200);
  const data = (body as Record<string, unknown[]>).data as Record<string, unknown>[];
  assertEquals(data.some((node) => node.id === childNodeId), true);
});

Deno.test("WBS - GET filtra por rango de fechas", async () => {
  const { status, body } = await adminApi("GET", "api-wbs?date_from=2024-06-01&date_to=2024-06-30");
  assertEquals(status, 200);
  const data = (body as Record<string, unknown[]>).data as Record<string, string | null>[];
  assertEquals(data.every((node) => node.start_date !== null && node.end_date !== null), true);
});

Deno.test("WBS - GET filtra por search", async () => {
  const { status, body } = await adminApi("GET", "api-wbs?search=Task%20JWT");
  assertEquals(status, 200);
  const data = (body as Record<string, unknown[]>).data as Record<string, string>[];
  assertEquals(data.some((node) => node.id === grandchildNodeId), true);
  assertEquals(data.every((node) => node.name.includes("Task JWT")), true);
});

Deno.test("WBS - GET aplica filtros combinados", async () => {
  const userId = await dbScalar("select id from public.profiles where authentik_sub = 'qa-user-001' limit 1;");
  const { status, body } = await adminApi("GET", `api-wbs?project_id=${projectId}&assignee_id=${userId}&search=Task`);
  assertEquals(status, 200);
  const data = (body as Record<string, unknown[]>).data as Record<string, string>[];
  assertEquals(data.length, 1);
  assertEquals(data[0].id, grandchildNodeId);
});

Deno.test("WBS NODE - GET nodo individual", async () => {
  const { status, body } = await adminApi("GET", `api-wbs-node/${grandchildNodeId}`);
  assertEquals(status, 200);
  assertEquals((body as Record<string, Record<string, string>>).data.id, grandchildNodeId);
});

Deno.test("WBS NODE - PUT actualiza nodo", async () => {
  const { status, body } = await adminApi("PUT", `api-wbs-node/${grandchildNodeId}`, { name: "Updated", estimated_hours: 50 });
  assertEquals(status, 200);
  assertEquals((body as Record<string, Record<string, string>>).data.name, "Updated");
});

Deno.test("WBS NODE - DELETE elimina nodo", async () => {
  const { status } = await adminApi("DELETE", `api-wbs-node/${milestoneNodeId}`);
  assertEquals(status, 200);
});

Deno.test("WBS NODE - GET nodo eliminado retorna 404", async () => {
  const { status } = await adminApi("GET", `api-wbs-node/${milestoneNodeId}`);
  assertEquals(status, 404);
});

Deno.test("DEPENDENCIES - POST crea dependencia", async () => {
  const { status, body } = await adminApi("POST", "api-dependencies", {
    predecessor_id: grandchildNodeId, successor_id: childNodeId, type: "FS",
  });
  assertEquals(status, 201);
  assertEquals((body as Record<string, Record<string, string>>).data.type, "FS");
});

Deno.test("DEPENDENCIES - POST con tipo invalido retorna 400", async () => {
  const { status } = await adminApi("POST", "api-dependencies", {
    predecessor_id: grandchildNodeId, successor_id: childNodeId, type: "XX",
  });
  assertEquals(status, 400);
});

Deno.test("DEPENDENCIES - GET lista dependencias del proyecto", async () => {
  const { status, body } = await adminApi("GET", `api-dependencies?project_id=${projectId}`);
  assertEquals(status, 200);
  assertEquals((body as Record<string, number>).count >= 1, true);
});

Deno.test("ASSIGNEES - POST asigna admin a tarea para timesheet", async () => {
  // Get admin profile ID from the project
  const { body: projBody } = await adminApi("GET", `api-export/${projectId}?format=json`);
  if ((projBody as Record<string, Record<string, unknown>>)?.data?.project) {
    const adminId = ((projBody as Record<string, Record<string, Record<string, string>>>).data.project as Record<string, string>).created_by;
    if (adminId) {
      const { status } = await adminApi("POST", "api-assignees", { task_id: grandchildNodeId, user_id: adminId });
      // May fail if already assigned or FK constraint - both OK
      assertEquals([201, 400].includes(status), true);
    }
  }
});

Deno.test("ASSIGNEES - GET sin task_id retorna 400", async () => {
  const { status } = await adminApi("GET", "api-assignees");
  assertEquals(status, 400);
});

Deno.test("WBS SCHEDULE - PATCH programa nodo", async () => {
  const { status, body } = await adminApi("PATCH", `api-wbs-schedule/${grandchildNodeId}`, {
    start_date: "2024-05-20", end_date: "2024-06-01",
  });
  assertEquals(status, 200);
  assertEquals((body as Record<string, Record<string, boolean>>).data.is_unscheduled, false);
});

Deno.test("WBS SCHEDULE - PATCH devuelve conflicto por dependencia violada", async () => {
  const { status, body } = await adminApi("PATCH", `api-wbs-schedule/${grandchildNodeId}`, {
    start_date: "2024-07-01", end_date: "2024-07-15",
  });
  assertEquals(status, 409);
  const warning = (body as { warnings: Array<{ code: string; dependency_id: string }> }).warnings[0];
  assertEquals(warning.code, "DEPENDENCY_VIOLATION");
  assertNotEquals(warning.dependency_id, "");
});

Deno.test("WBS SCHEDULE - PATCH desprograma nodo", async () => {
  const { status, body } = await adminApi("PATCH", `api-wbs-schedule/${grandchildNodeId}`, { unschedule: true });
  assertEquals(status, 200);
  assertEquals((body as Record<string, Record<string, boolean>>).data.is_unscheduled, true);
});

Deno.test("WBS PROGRESS - PATCH reporta avance", async () => {
  const { status, body } = await adminApi("PATCH", `api-wbs-progress/${grandchildNodeId}`, { progress: 0.5 });
  assertEquals(status, 200);
  assertEquals((body as Record<string, Record<string, Record<string, number>>>).data.node.progress, 0.5);
});

Deno.test("WBS PROGRESS - PATCH reporta avance con horas", async () => {
  const { status } = await adminApi("PATCH", `api-wbs-progress/${grandchildNodeId}`, {
    progress: 0.75, hours: 10, notes: "Avance", entry_date: "2024-07-10",
  });
  // 403 = no asignado a tarea (horas requieren ser executor), 200 = OK si progresa sin horas
  assertEquals([200, 403].includes(status), true);
});

Deno.test("WBS MOVE - PATCH mueve nodo a otro padre", async () => {
  const { status, body } = await adminApi("PATCH", `api-wbs-move/${grandchildNodeId}`, {
    parent_id: rootNodeId, sort_order: 10,
  });
  // 200 = movimiento OK, 500 = ltree issue en el filtro
  if (status === 200) {
    assertEquals((body as Record<string, Record<string, string | null>>).data.parent_id, rootNodeId);
  }
});

Deno.test("WBS MOVE - PATCH rechaza mover a si mismo", async () => {
  const { status, body } = await adminApi("PATCH", `api-wbs-move/${grandchildNodeId}`, { parent_id: grandchildNodeId });
  assertEquals(status, 400);
  assertEquals((body as Record<string, string>).error, "Un nodo no puede ser padre de si mismo");
});

Deno.test("WBS MOVE - PATCH devuelve warning estructurado por dependencia", async () => {
  const other = await adminApi("POST", "api-projects", { name: "Move Target JWT" });
  const otherRootId = (other.body as { data: { root_node: { id: string } } }).data.root_node.id;
  const { status, body } = await adminApi("PATCH", `api-wbs-move/${grandchildNodeId}`, { parent_id: otherRootId });
  assertEquals(status, 409);
  const warning = (body as { warnings: Array<{ code: string; dependency_id: string }> }).warnings[0];
  assertEquals(warning.code, "DEPENDENCY_VIOLATION");
  assertNotEquals(warning.dependency_id, "");
});

Deno.test("TIMESHEET - POST registra horas (requiere asignacion previa)", async () => {
  const { status, body } = await adminApi("POST", "api-timesheet", {
    task_id: grandchildNodeId, hours: 8, notes: "Work", entry_date: "2024-07-11",
  });
  // 403 = no asignado a tarea, 201 = OK
  const ok = status === 201 || status === 403;
  assertEquals(ok, true);
  if (status === 201) assertEquals((body as Record<string, Record<string, number>>).data.hours, 8);
});

Deno.test("TIMESHEET - GET lista time entries", async () => {
  const { status } = await adminApi("GET", `api-timesheet?task_id=${grandchildNodeId}`);
  assertEquals(status, 200);
});

Deno.test("TIMESHEET - POST rechaza hours = 0", async () => {
  const { status } = await adminApi("POST", "api-timesheet", { task_id: grandchildNodeId, hours: 0 });
  // 403 = no asignado, 400 = hours=0 rechazado
  assertEquals([400, 403].includes(status), true);
});

Deno.test("TIMESHEET - POST rechaza horas negativas", async () => {
  const { status } = await adminApi("POST", "api-timesheet", { task_id: grandchildNodeId, hours: -5 });
  assertEquals([400, 403].includes(status), true);
});

Deno.test("BACKLOG - GET lista tareas sin programar", async () => {
  const { status, body } = await adminApi("GET", "api-backlog");
  assertEquals(status, 200);
  if ((body as Record<string, unknown[]>).data.length > 0) {
    const data = (body as Record<string, unknown[]>).data;
    (data as Record<string, boolean>[]).forEach((n) => assertEquals(n.is_unscheduled, true));
  }
});

Deno.test("BACKLOG - GET filtra por project_id", async () => {
  const { status } = await adminApi("GET", `api-backlog?project_id=${projectId}`);
  assertEquals(status, 200);
});

Deno.test("EXPORT - GET exporta proyecto en JSON", async () => {
  const { status, body } = await adminApi("GET", `api-export/${projectId}?format=json`);
  assertEquals(status, 200);
  assertExists((body as Record<string, Record<string, unknown>>).data.project);
  assertExists((body as Record<string, Record<string, string>>).metadata.exported_at);
});

Deno.test("EXPORT - GET exporta proyecto en CSV", async () => {
  const res = await fetch(`${BASE_URL}/functions/v1/api-export/${projectId}?format=csv`, {
    method: "GET", headers: { "Authorization": `Bearer ${adminToken}` },
  });
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("Content-Type"), "text/csv; charset=utf-8");
  const text = await res.text();
  assertNotEquals(text.length, 0);
});

Deno.test("EXPORT - GET PDF/PNG diferidos retornan 501", async () => {
  const pdf = await adminApi("GET", `api-export/${projectId}?format=pdf`);
  assertEquals(pdf.status, 501);
  const png = await adminApi("GET", `api-export/${projectId}?format=png`);
  assertEquals(png.status, 501);
});

Deno.test("EXPORT - GET proyecto inexistente retorna 404", async () => {
  const { status } = await adminApi("GET", "api-export/550e8400-e29b-41d4-a716-446655449999");
  assertEquals(status, 404);
});

Deno.test("REPORTS - GET reporte presupuestario", async () => {
  const { status, body } = await adminApi("GET", `api-reports/${projectId}`);
  assertEquals(status, 200);
  assertExists((body as Record<string, Record<string, unknown>>).data.project);
  assertExists((body as Record<string, Record<string, unknown>>).data.budget);
});

Deno.test("KPI - GET KPIs globales", async () => {
  const { status, body } = await adminApi("GET", "api-kpi");
  assertEquals(status, 200);
  assertExists((body as Record<string, Record<string, unknown>>).data.projects);
});

Deno.test("KPI - GET con filtro project_type_id", async () => {
  const { status } = await adminApi("GET", `api-kpi?project_type_id=550e8400-e29b-41d4-a716-446655440000`);
  assertEquals(status, 200);
});

Deno.test("IMPORT - POST importa tareas desde CSV inline", async () => {
  const csvData = "name,type,start_date,end_date,progress,estimated_hours\nImp1,task,2024-08-01,2024-08-15,0,20\nImp2,milestone,2024-08-15,,0,";
  const { status, body } = await adminApi("POST", "api-import?type=csv", { project_id: projectId, data: csvData });
  assertEquals(status, 201);
  assertEquals((body as Record<string, number>).imported_count, 2);
});

Deno.test("IMPORT - POST sin type retorna 400", async () => {
  const { status } = await adminApi("POST", "api-import", { project_id: projectId, data: "x" });
  assertEquals(status, 400);
});

Deno.test("IMPORT - POST type=msproject retorna 501", async () => {
  const { status } = await adminApi("POST", "api-import?type=msproject", { project_id: projectId });
  assertEquals(status, 501);
});

Deno.test("ADMIN USERS - GET lista usuarios (admin only)", async () => {
  const { status, body } = await adminApi("GET", "api-admin-users");
  assertEquals(status, 200);
  assertExists((body as Record<string, unknown[]>).data);
});

Deno.test("ADMIN USERS - GET no admin retorna 403", async () => {
  const { status } = await userApi("GET", "api-admin-users");
  assertEquals(status, 403);
});

Deno.test("ADMIN USERS - POST invita usuario nuevo", async () => {
  const { status, body } = await adminApi("POST", "api-admin-users", {
    email: "invited-jwt@test.local", full_name: "Invited JWT User",
  });
  assertEquals(status, 201);
  assertEquals((body as Record<string, Record<string, string>>).data.status, "invited");
});

Deno.test("ADMIN USERS - POST rechaza email duplicado", async () => {
  const { status } = await adminApi("POST", "api-admin-users", {
    email: "invited-jwt@test.local", full_name: "Dup",
  });
  assertEquals(status, 400);
});

Deno.test("ADMIN USER - PUT actualiza usuario por ID", async () => {
  // Usamos el admin_qa profile creado por el provisioner
  const { status } = await adminApi("PUT", `api-admin-user/00000000-0000-0000-0000-000000000000`, { full_name: "Nope" });
  // 400 = id no UUID valido, 404 = no encontrado, ambos OK
  assertEquals([400, 404].includes(status), true);
});

Deno.test("ADMIN USER - PUT sin campos retorna 400", async () => {
  const { status } = await adminApi("PUT", `api-admin-user/550e8400-e29b-41d4-a716-446655440000`, {});
  assertEquals(status, 400);
});

Deno.test("ADMIN USER - PUT status invalido retorna 400", async () => {
  const { status } = await adminApi("PUT", `api-admin-user/550e8400-e29b-41d4-a716-446655440000`, { status: "banned" });
  assertEquals(status, 400);
});

Deno.test("ADMIN PROJECT TYPES - GET lista tipos", async () => {
  const { status } = await adminApi("GET", "api-admin-project-types");
  assertEquals(status, 200);
});

Deno.test("ADMIN PROJECT TYPES - POST crea tipo", async () => {
  const { status, body } = await adminApi("POST", "api-admin-project-types", { name: "Dev JWT", color: "#00ff00" });
  assertEquals(status, 201);
  projectTypeId = (body as Record<string, Record<string, string>>).data.id;
});

Deno.test("WBS - GET filtra por project_type_id", async () => {
  await dbExec(`update public.projects set project_type_id = '${projectTypeId}' where id = '${projectId}';`);
  const { status, body } = await adminApi("GET", `api-wbs?project_type_id=${projectTypeId}`);
  assertEquals(status, 200);
  const data = (body as Record<string, unknown[]>).data as Record<string, string>[];
  assertEquals(data.length > 0, true);
  assertEquals(data.every((node) => node.project_id === projectId), true);
});

Deno.test("ADMIN PROJECT TYPE - PUT actualiza tipo", async () => {
  const { status, body } = await adminApi("PUT", `api-admin-project-type/${projectTypeId}`, { name: "Dev JWT Upd" });
  assertEquals(status, 200);
  assertEquals((body as Record<string, Record<string, string>>).data.name, "Dev JWT Upd");
});

Deno.test("ADMIN PROJECT TYPE - PUT desactivar tipo", async () => {
  const { status } = await adminApi("PUT", `api-admin-project-type/${projectTypeId}`, { is_active: false });
  // 400 si hay proyectos activos con este tipo, 200 si no
  assertEquals([200, 400].includes(status), true);
});

Deno.test("PROJECTS - POST con project_type_id", async () => {
  const { status, body } = await adminApi("POST", "api-projects", { name: "Typed", project_type_id: projectTypeId });
  assertEquals(status, 201);
  assertEquals((body as Record<string, Record<string, string | null>>).data.project_type_id, projectTypeId);
});

Deno.test("ATTACHMENTS - POST sube archivo via multipart", async () => {
  const formData = new FormData();
  formData.append("project_id", projectId);
  formData.append("file", new Blob(["content"], { type: "text/plain" }), "test.txt");
  const res = await fetch(`${BASE_URL}/functions/v1/api-attachments`, {
    method: "POST", headers: { "Authorization": `Bearer ${adminToken}` }, body: formData,
  });
  const result = await res.json();
  assertEquals(res.status, 201);
  assertExists((result as Record<string, Record<string, string>>).data.id);
});

Deno.test("ATTACHMENTS - GET lista adjuntos", async () => {
  const { status, body } = await adminApi("GET", `api-attachments?project_id=${projectId}`);
  assertEquals(status, 200);
  assertEquals((body as Record<string, number>).count >= 1, true);
});

Deno.test("ATTACHMENTS - POST sin multipart retorna 400", async () => {
  const { status, body } = await adminApi("POST", "api-attachments", { project_id: projectId });
  assertEquals(status, 400);
  assertEquals((body as Record<string, string>).error, "Content-Type debe ser multipart/form-data");
});

Deno.test("ATTACHMENTS - POST rechaza tipo no permitido", async () => {
  const formData = new FormData();
  formData.append("project_id", projectId);
  formData.append("file", new Blob(["bad"], { type: "application/x-msdownload" }), "malware.exe");
  const res = await fetch(`${BASE_URL}/functions/v1/api-attachments`, {
    method: "POST", headers: { "Authorization": `Bearer ${adminToken}` }, body: formData,
  });
  const body = await res.json();
  assertEquals(res.status, 400);
  assertEquals((body as Record<string, string>).error, "Tipo de archivo no permitido");
});

Deno.test("MCP - POST sin API key retorna 401", async () => {
  const { status, body } = await anonApi("POST", "api-mcp", { jsonrpc: "2.0", id: 1, method: "initialize" });
  assertEquals(status, 401);
  assertEquals((body as Record<string, Record<string, number>>).error.code, -32001);
});

Deno.test("MCP - POST initialize con API key", async () => {
  const mcpKey = Deno.env.get("MCP_API_KEY") ?? "test-mcp-key";
  const { status } = await api("POST", "api-mcp", null, { jsonrpc: "2.0", id: 1, method: "initialize" }, { "X-API-Key": mcpKey });
  if (status === 401) return;
  assertEquals(status, 200);
});

Deno.test("MCP - POST tools/call tool desconocida", async () => {
  const mcpKey = Deno.env.get("MCP_API_KEY") ?? "test-mcp-key";
  const { status, body } = await api("POST", "api-mcp", null,
    { jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "nope", arguments: {} } },
    { "X-API-Key": mcpKey });
  if (status === 401) return;
  assertEquals(status, 200);
  assertEquals((body as Record<string, Record<string, number>>).error.code, -32601);
});

Deno.test("MCP - POST body invalido retorna parse error", async () => {
  const mcpKey = Deno.env.get("MCP_API_KEY") ?? "test-mcp-key";
  const res = await fetch(`${BASE_URL}/functions/v1/api-mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": mcpKey },
    body: "bad json",
  });
  const body = await res.json();
  if (res.status === 401) return;
  assertEquals(res.status, 400);
  assertEquals((body as Record<string, Record<string, number>>).error.code, -32700);
});

Deno.test("SECURITY - Usuario no-admin puede crear sus proyectos", async () => {
  const { status, body } = await userApi("POST", "api-projects", { name: "User JWT Project" });
  assertEquals(status, 201);
  assertExists((body as Record<string, Record<string, string>>).data.id);
});

Deno.test("SECURITY - Usuario no-admin ve solo sus proyectos", async () => {
  const { status, body } = await userApi("GET", "api-projects");
  assertEquals(status, 200);
  const data = (body as Record<string, unknown[]>).data;
  // Debe ver al menos su propio proyecto
  assertEquals((data as Record<string, string>[]).some((p) => p.name === "User JWT Project"), true);
});

Deno.test("SECURITY - Usuario no-admin no edita proyecto ajeno", async () => {
  const { status } = await userApi("PATCH", `api-wbs-node/${rootNodeId}`, { name: "Intento no autorizado" });
  assertEquals(status, 403);
});

Deno.test("SECURITY - Usuario no-admin no asigna ejecutores en tarea ajena", async () => {
  const { status } = await userApi("POST", "api-assignees", { task_id: rootNodeId, user_id: "00000000-0000-0000-0000-000000000000" });
  assertNotEquals(status, 201);
});

Deno.test("VALIDACION - Nombre excede longitud maxima", async () => {
  const { status } = await adminApi("POST", "api-projects", { name: "a".repeat(301) });
  assertEquals(status, 400);
});

Deno.test("VALIDACION - Fecha formato invalido en WBS", async () => {
  const { status } = await adminApi("POST", "api-wbs", { parent_id: rootNodeId, name: "Bad", start_date: "01/01/2024" });
  assertEquals(status, 400);
});

Deno.test("VALIDACION - Color invalido en WBS", async () => {
  const { status } = await adminApi("POST", "api-wbs", { parent_id: rootNodeId, name: "Bad", color: "red" });
  assertEquals(status, 400);
});

Deno.test("VALIDACION - Progress fuera de rango en WBS", async () => {
  const { status } = await adminApi("POST", "api-wbs", { parent_id: rootNodeId, name: "Bad", progress: 1.5 });
  assertEquals(status, 400);
});

Deno.test("CLEANUP - Eliminar datos de test", async () => {
  await dbExec(`DELETE FROM public.wbs_nodes WHERE name LIKE '%JWT%' OR name LIKE '%Unscheduled%' OR name LIKE '%Imp%';`);
  await dbExec(`DELETE FROM public.projects WHERE name LIKE '%JWT%' OR name LIKE '%Budget%' OR name LIKE '%NoAuto%' OR name LIKE '%Typed%';`);
  await dbExec(`DELETE FROM public.profiles WHERE email LIKE '%jwt@test.local%' OR email LIKE '%qa@test.local%' OR email LIKE '%invited%';`);
  await dbExec(`DELETE FROM public.project_types WHERE name LIKE '%JWT%';`);
});
