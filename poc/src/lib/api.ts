import type { ApiEnvelope, Attachment, BudgetReport, Dependency, DependencyType, NodeType, PortfolioData, Profile, Project, Summary, TaskAssignee, Team, WbsNode } from './types';
import { config } from './runtimeConfig';

const API_BASE_URL = config.apiBaseUrl;
const DEV_TOKEN = config.devAuthToken;

export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export function getStoredToken(): string | null {
  return window.localStorage.getItem('abax.auth.token') || DEV_TOKEN || null;
}

export function storeToken(token: string) {
  window.localStorage.setItem('abax.auth.token', token);
}

export function clearToken() {
  window.localStorage.removeItem('abax.auth.token');
}

// V-08 fix: si el backend devuelve 401, limpiamos el token y redirigimos al login.
// Disparamos un CustomEvent para que el shell decida cómo notificar al usuario.
function handleUnauthorized() {
  try { window.localStorage.removeItem('abax.auth.token'); } catch { /* ignore */ }
  try { window.dispatchEvent(new CustomEvent('abax:unauthorized')); } catch { /* ignore */ }
}

async function apiGet<T>(path: string, token: string): Promise<T> {
  const res = await fetch(apiUrl(path), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 401) { handleUnauthorized(); throw new Error('Tu sesión expiró. Vuelve a entrar.'); }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(parseApiError(body) || `Request failed: ${res.status}`);
  }

  const json = (await res.json()) as ApiEnvelope<T>;
  return json.data;
}

async function optionalApiGet<T>(path: string, token: string, fallback: T): Promise<T> {
  try {
    return await apiGet<T>(path, token);
  } catch {
    return fallback;
  }
}

async function apiSend<T>(path: string, token: string, method: 'POST' | 'PATCH', body: unknown): Promise<T> {
  const res = await fetch(apiUrl(path), {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (res.status === 401) { handleUnauthorized(); throw new Error('Tu sesión expiró. Vuelve a entrar.'); }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(parseApiError(text) || `Request failed: ${res.status}`);
  }

  const json = (await res.json()) as ApiEnvelope<T>;
  return json.data;
}

// Variante de apiSend que devuelve el envelope completo. La usamos en endpoints
// que devuelven info adicional (ej: ancestros recalculados).
async function apiSendEnvelope<T>(path: string, token: string, method: 'POST' | 'PATCH', body: unknown): Promise<ApiEnvelope<T> & { ancestors?: WbsNode[] }> {
  const res = await fetch(apiUrl(path), {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (res.status === 401) { handleUnauthorized(); throw new Error('Tu sesión expiró. Vuelve a entrar.'); }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(parseApiError(text) || `Request failed: ${res.status}`);
  }

  return (await res.json()) as ApiEnvelope<T> & { ancestors?: WbsNode[] };
}

async function apiDelete(path: string, token: string): Promise<void> {
  const res = await fetch(apiUrl(path), {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) { handleUnauthorized(); throw new Error('Tu sesión expiró. Vuelve a entrar.'); }
  if (!res.ok) throw new Error(parseApiError(await res.text()) || `Request failed: ${res.status}`);
}

function parseApiError(text: string): string {
  if (!text) return '';
  try {
    const parsed = JSON.parse(text) as { error?: string; message?: string };
    return parsed.error ?? parsed.message ?? text;
  } catch {
    return text;
  }
}

export interface PortfolioFilters {
  project_id?: string | null;
  project_type_id?: string | null;
  responsible_id?: string | null;
  assignee_id?: string | null;
  status?: string | null;
  date_from?: string | null;
  date_to?: string | null;
  search?: string | null;
  my_tasks?: boolean;
  unscheduled?: boolean;
  active_only?: boolean;
}

export async function loadPortfolio(token: string, filters?: PortfolioFilters): Promise<PortfolioData> {
  const queryParams = new URLSearchParams();
  if (filters?.project_id) queryParams.set('project_id', filters.project_id);
  if (filters?.project_type_id) queryParams.set('project_type_id', filters.project_type_id);
  if (filters?.responsible_id) queryParams.set('responsible_id', filters.responsible_id);
  if (filters?.assignee_id) queryParams.set('assignee_id', filters.assignee_id);
  if (filters?.status) queryParams.set('status', filters.status);
  if (filters?.date_from) queryParams.set('date_from', filters.date_from);
  if (filters?.date_to) queryParams.set('date_to', filters.date_to);
  if (filters?.search) queryParams.set('search', filters.search);
  if (filters?.unscheduled) queryParams.set('unscheduled', 'true');
  if (filters?.my_tasks) queryParams.set('my_tasks', 'true');
  if (filters?.active_only) queryParams.set('active_only', 'true');
  const filterStr = queryParams.toString();

  // Rediseño Fase 9: fetch de `teams` para habilitar agrupación por equipo en
  // el portafolio. Es optional para que el frontend no rompa si la migración
  // 00011 aún no se ha aplicado en el entorno (devuelve [] y groupBy=team se
  // comporta como groupBy=none).
  const [projects, users, teams, nodes, backlog, dependencies, summary] = await Promise.all([
    apiGet<Project[]>('api/projects', token),
    optionalApiGet<Profile[]>('api/users', token, []),
    optionalApiGet<Team[]>('api/teams', token, []),
    apiGet<WbsNode[]>(`api/wbs${filterStr ? `?${filterStr}` : ''}`, token),
    apiGet<WbsNode[]>(`api/backlog${filterStr ? `?${filterStr}` : ''}`, token),
    apiGet<Dependency[]>('api/dependencies', token),
    apiGet<Summary>('api/summary', token),
  ]);

  return { projects, users, teams, nodes, backlog, dependencies, summary };
}

export async function createProject(token: string, input: { name: string; team_id?: string | null }) {
  return apiSend<Project & { root_node: WbsNode }>('api/projects', token, 'POST', input);
}

/* ---------------------------------------------------------------------------
 * Teams (admin) — Fase 9 + creación desde UI.
 * GET público (lista activos) vive en api/teams; el detalle admin en
 * api/admin/teams. Devolvemos la lista completa para que el admin pueda
 * activar/desactivar.
 * ------------------------------------------------------------------------- */
export async function listAdminTeams(token: string) {
  return apiGet<Team[]>('api/admin/teams', token);
}

export async function createTeam(token: string, input: { name: string; description?: string | null; color?: string | null; lead_id?: string | null }) {
  return apiSend<Team>('api/admin/teams', token, 'POST', input);
}

export async function updateTeam(token: string, id: string, patch: Partial<Pick<Team, 'name' | 'description' | 'color' | 'lead_id' | 'is_active'>>) {
  return apiSend<Team>(`api/admin/teams/${id}`, token, 'PATCH', patch);
}

export async function createWbsNode(token: string, input: { parent_id: string; name: string; type: NodeType; start_date?: string | null; end_date?: string | null }) {
  return apiSend<WbsNode>('api/wbs', token, 'POST', input);
}

export async function updateWbsNode(token: string, id: string, patch: Partial<Pick<WbsNode, 'name' | 'description' | 'status' | 'start_date' | 'end_date' | 'progress' | 'estimated_hours' | 'estimated_cost' | 'color' | 'responsible_id'>>) {
  return apiSend<WbsNode>(`api/wbs/${id}`, token, 'PATCH', patch);
}

export async function scheduleWbsNode(token: string, id: string, input: { start_date: string; end_date?: string | null }): Promise<{ node: WbsNode; ancestors: WbsNode[] }> {
  const envelope = await apiSendEnvelope<WbsNode>(`api/wbs/schedule/${id}`, token, 'PATCH', input);
  return { node: envelope.data, ancestors: envelope.ancestors ?? [] };
}

export async function unscheduleWbsNode(token: string, id: string) {
  return apiSend<WbsNode>(`api/wbs/schedule/${id}`, token, 'PATCH', { unschedule: true });
}

/**
 * Borra el nodo. El backend hace `DELETE FROM wbs_nodes WHERE id = $1` y la
 * FK `parent_id ... ON DELETE CASCADE` (migración 00001) se encarga de
 * borrar toda la subtree, sus dependencias, assignees y time entries. RLS:
 * exige `can_manage_node` en el nodo o su padre.
 */
export async function deleteWbsNode(token: string, id: string): Promise<void> {
  return apiDelete(`api/wbs/${id}`, token);
}

export async function listAssignees(token: string, taskId: string) {
  return apiGet<TaskAssignee[]>(`api/assignees?task_id=${encodeURIComponent(taskId)}`, token);
}

export async function addAssignee(token: string, taskId: string, userId: string) {
  return apiSend<TaskAssignee>('api/assignees', token, 'POST', { task_id: taskId, user_id: userId });
}

export async function removeAssignee(token: string, assignmentId: string) {
  return apiDelete(`api/assignees/${assignmentId}`, token);
}

export async function reportProgress(token: string, nodeId: string, input: { progress: number; hours?: number | null; notes?: string }) {
  return apiSend<{ node: WbsNode; time_entry: unknown | null }>(`api/wbs/progress/${nodeId}`, token, 'PATCH', input);
}

export async function createDependency(token: string, input: { predecessor_id: string; successor_id: string; type: DependencyType }) {
  return apiSend<Dependency>('api/dependencies', token, 'POST', input);
}

export async function deleteDependency(token: string, dependencyId: string) {
  return apiDelete(`api/dependencies/${dependencyId}`, token);
}

export async function moveWbsNode(token: string, id: string, input: { parent_id?: string | null; sort_order?: number }): Promise<{ node: WbsNode; ancestors: WbsNode[] }> {
  const envelope = await apiSendEnvelope<WbsNode>(`api/wbs/move/${id}`, token, 'PATCH', input);
  return { node: envelope.data, ancestors: envelope.ancestors ?? [] };
}

export async function listAttachments(token: string, projectId: string) {
  return apiGet<Attachment[]>(`api/attachments?project_id=${encodeURIComponent(projectId)}`, token);
}

export async function uploadAttachment(token: string, projectId: string, file: File) {
  const form = new FormData();
  form.set('project_id', projectId);
  form.set('file', file);
  const res = await fetch(apiUrl('api/attachments'), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) throw new Error(await res.text());
  const json = (await res.json()) as ApiEnvelope<Attachment>;
  return json.data;
}

export async function deleteAttachment(token: string, attachmentId: string) {
  return apiDelete(`api/attachments/${attachmentId}`, token);
}

export async function getBudgetReport(token: string, projectId: string) {
  return apiGet<BudgetReport>(`api/reports/${projectId}`, token);
}

export async function listTimeEntries(token: string, taskId: string) {
  return apiGet<Array<{ id: string; task_id: string; user_id: string; hours: number; notes: string | null; entry_date: string; profiles: { id: string; full_name: string; avatar_url: string | null } | null }>>(`api/timesheet?task_id=${encodeURIComponent(taskId)}`, token);
}

export async function createTimeEntry(token: string, input: { task_id: string; hours: number; notes?: string; entry_date?: string }) {
  return apiSend<{ id: string }>('api/timesheet', token, 'POST', input);
}
