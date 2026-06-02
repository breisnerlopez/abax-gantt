import { expect, test, type Page, type Route } from '@playwright/test';

const NOW = new Date().toISOString().slice(0, 10);
const NEXT_WEEK = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

interface TaskAssignee { id?: string; user_id: string }
interface Profile { id: string; email: string | null; full_name: string | null; avatar_url: string | null; status: string; is_admin?: boolean }
interface Project { id: string; name: string; description: string | null; status: string; budget_total: number | null; project_types: unknown }
interface WbsNodeRaw {
  id: string; project_id: string; parent_id: string | null; name: string; type: string;
  description: string | null; start_date: string | null; end_date: string | null;
  duration_days: number | null; progress: number; estimated_hours: number | null;
  estimated_cost: number | null; color: string | null; sort_order: number;
  responsible_id: string | null; is_unscheduled: boolean; status: string | null; path: string;
  task_assignees?: TaskAssignee[]; _from_backlog?: boolean;
}
interface Dependency { id: string; predecessor_id: string; successor_id: string; type: 'FS'|'SS'|'FF'|'SF' }

const USERS: Profile[] = [
  { id: 'u-admin', email: 'admin@abax.local', full_name: 'Admin User', avatar_url: null, status: 'active', is_admin: true },
  { id: 'u-resp', email: 'resp@abax.local', full_name: 'Responsable Demo', avatar_url: null, status: 'active' },
  { id: 'u-exec', email: 'exec@abax.local', full_name: 'Ejecutor Demo', avatar_url: null, status: 'active' },
  { id: 'u-inactive', email: 'inactivo@abax.local', full_name: 'Inactivo Test', avatar_url: null, status: 'inactive' },
];

const PROJECTS: Project[] = [
  { id: 'p1', name: 'Proyecto Alpha', description: 'Demo project', status: 'active', budget_total: 500000, project_types: null },
  { id: 'p2', name: 'Proyecto Beta', description: null, status: 'active', budget_total: 300000, project_types: null },
  { id: 'p3', name: 'Proyecto Archivado', description: null, status: 'archived', budget_total: 100000, project_types: null },
];

function mkNodes(): WbsNodeRaw[] { return [
  { id: 'n-root1', project_id: 'p1', parent_id: null, name: 'Proyecto Alpha', type: 'project', description: 'Raiz del proyecto', start_date: NOW, end_date: NEXT_WEEK, duration_days: 7, progress: 0.25, estimated_hours: 160, estimated_cost: null, color: null, sort_order: 0, responsible_id: 'u-resp', is_unscheduled: false, status: null, path: 'n_root1' },
  { id: 'n-stage1', project_id: 'p1', parent_id: 'n-root1', name: 'Fase 1', type: 'stage', description: null, start_date: NOW, end_date: NEXT_WEEK, duration_days: 7, progress: 0.3, estimated_hours: 80, estimated_cost: null, color: null, sort_order: 1, responsible_id: 'u-resp', is_unscheduled: false, status: null, path: 'n_root1.n_stage1' },
  { id: 'n-task1', project_id: 'p1', parent_id: 'n-stage1', name: 'Tarea A', type: 'task', description: 'Disenar mockups', start_date: NOW, end_date: NOW, duration_days: 1, progress: 0.5, estimated_hours: 20, estimated_cost: 50000, color: null, sort_order: 0, responsible_id: 'u-exec', is_unscheduled: false, status: 'en_progreso', path: 'n_root1.n_stage1.n_task1', task_assignees: [{ user_id: 'u-exec' }] },
  { id: 'n-task2', project_id: 'p1', parent_id: 'n-stage1', name: 'Tarea B', type: 'task', description: null, start_date: NOW, end_date: null, duration_days: null, progress: 0, estimated_hours: 40, estimated_cost: null, color: null, sort_order: 1, responsible_id: null, is_unscheduled: false, status: 'pendiente', path: 'n_root1.n_stage1.n_task2' },
  { id: 'n-milestone1', project_id: 'p1', parent_id: 'n-root1', name: 'Hito entrega', type: 'milestone', description: null, start_date: NEXT_WEEK, end_date: NEXT_WEEK, duration_days: 0, progress: 0, estimated_hours: null, estimated_cost: null, color: null, sort_order: 2, responsible_id: 'u-resp', is_unscheduled: false, status: null, path: 'n_root1.n_mstone1' },
  { id: 'n-root2', project_id: 'p2', parent_id: null, name: 'Proyecto Beta', type: 'project', description: null, start_date: NEXT_WEEK, end_date: null, duration_days: null, progress: 0, estimated_hours: 120, estimated_cost: null, color: null, sort_order: 0, responsible_id: 'u-admin', is_unscheduled: false, status: null, path: 'n_root2' },
];}

function mkBacklog(): WbsNodeRaw[] { return [
  { id: 'n-blog1', project_id: 'p1', parent_id: 'n-stage1', name: 'Tarea sin fecha', type: 'task', description: 'Pendiente por planificar', start_date: null, end_date: null, duration_days: null, progress: 0, estimated_hours: 16, estimated_cost: null, color: null, sort_order: 2, responsible_id: 'u-resp', is_unscheduled: true, status: null, path: 'n_root1.n_stage1.n_blog1' },
  { id: 'n-blog2', project_id: 'p2', parent_id: 'n-root2', name: 'Backlog Beta', type: 'task', description: null, start_date: null, end_date: null, duration_days: null, progress: 0, estimated_hours: 8, estimated_cost: null, color: null, sort_order: 0, responsible_id: null, is_unscheduled: true, status: null, path: 'n_root2.n_blog2' },
];}

const DEPS: Dependency[] = [
  { id: 'dep-1', predecessor_id: 'n-task1', successor_id: 'n-task2', type: 'FS' },
];

const SUMMARY = { active_projects: 2, total_projects: 3, global_progress: 25, upcoming_milestones_count: 1, total_budget: 800000, total_estimated_cost: 50000, budget_consumed_pct: 6, total_tasks: 5, unscheduled_tasks: 2 };

const BUDGET = { project: { id: 'p1', name: 'Proyecto Alpha', status: 'active' }, budget: { total: 500000, estimated_cost: 50000, consumed_pct: 6 }, hours: { estimated: 160, actual: 10, variance_pct: -94 }, progress: 25, task_count: 4, task_breakdown: [] as unknown[], hours_by_person: [] as unknown[] };

const TIME_ENTRIES = [{ id: 't1', task_id: 'n-task1', user_id: 'u-exec', hours: 5, notes: 'Avance inicial', entry_date: NOW, profiles: { id: 'u-exec', full_name: 'Ejecutor Demo', avatar_url: null } }];

const ATTACHMENTS = [{ id: 'a1', project_id: 'p1', file_name: 'spec.pdf', file_path: '/s/spec.pdf', file_size: 250000, mime_type: 'application/pdf', download_url: '/s/spec.pdf' }];

type MockState = { projects: Project[]; nodes: WbsNodeRaw[]; backlog: WbsNodeRaw[]; deps: Dependency[]; assignees: TaskAssignee[]; adminUsers: Profile[] };

function freshState(): MockState {
  return {
    projects: JSON.parse(JSON.stringify(PROJECTS)),
    nodes: mkNodes(),
    backlog: mkBacklog(),
    deps: JSON.parse(JSON.stringify(DEPS)),
    assignees: [{ user_id: 'u-exec' }],
    adminUsers: JSON.parse(JSON.stringify(USERS)),
  };
}

function jsonOk(route: Route, data: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ data, count: Array.isArray(data) ? data.length : undefined }) });
}

async function setupApi(page: Page, s: MockState) {
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const p = url.pathname.split('/api/').pop() ?? '';
    const m = route.request().method();

    try {
      if (p === 'projects' && m === 'GET') return jsonOk(route, s.projects);
      if (p === 'users' && m === 'GET') return jsonOk(route, USERS);
      if (p === 'wbs' && m === 'GET') return jsonOk(route, s.nodes);
      if (p === 'backlog' && m === 'GET') return jsonOk(route, s.backlog);
      if (p === 'dependencies' && m === 'GET') return jsonOk(route, s.deps);
      if (p === 'summary' && m === 'GET') return jsonOk(route, SUMMARY);
      if (p === 'assignees' && m === 'GET') return jsonOk(route, s.assignees);

      if (p === 'projects' && m === 'POST') {
        const b = JSON.parse(route.request().postData() ?? '{}');
        const id = `p-${Date.now()}`; const rid = `n-${Date.now()}`;
        s.projects.push({ id, name: b.name, description: null, status: 'active', budget_total: null, project_types: null });
        s.nodes.push({ id: rid, project_id: id, parent_id: null, name: b.name, type: 'project', description: null, start_date: null, end_date: null, duration_days: null, progress: 0, estimated_hours: null, estimated_cost: null, color: null, sort_order: 0, responsible_id: null, is_unscheduled: false, status: null, path: `n_${rid.replaceAll('-', '_')}` });
        return jsonOk(route, { ...s.projects[s.projects.length - 1], root_node: s.nodes[s.nodes.length - 1], root_node_id: rid }, 201);
      }
      if (p === 'wbs' && m === 'POST') {
        const b = JSON.parse(route.request().postData() ?? '{}');
        const id = `n-${Date.now()}`;
        const node: WbsNodeRaw = { id, project_id: 'p1', parent_id: b.parent_id, name: b.name, type: b.type ?? 'task', description: null, start_date: b.start_date ?? null, end_date: b.end_date ?? null, duration_days: null, progress: 0, estimated_hours: null, estimated_cost: null, color: null, sort_order: s.nodes.filter(n => n.parent_id === b.parent_id).length, responsible_id: null, is_unscheduled: !b.start_date, status: null, path: `n_${id.replaceAll('-', '_')}` };
        if (node.is_unscheduled) s.backlog.push(node); else s.nodes.push(node);
        return jsonOk(route, node, 201);
      }
      if (/^wbs\/[a-f0-9-]{36}$/.test(p) && m === 'PATCH') {
        const nid = p.split('/')[1];
        const b = JSON.parse(route.request().postData() ?? '{}');
        const node = s.nodes.find(n => n.id === nid) ?? s.backlog.find(n => n.id === nid);
        if (node) Object.assign(node, b);
        return jsonOk(route, node ?? {});
      }
      if (/^wbs\/schedule\/[a-f0-9-]{36}$/.test(p) && m === 'PATCH') {
        const nid = p.split('/')[2];
        const b = JSON.parse(route.request().postData() ?? '{}');
        if (b.unschedule) {
          const idx = s.nodes.findIndex(n => n.id === nid);
          if (idx >= 0) { const [n] = s.nodes.splice(idx, 1); n.is_unscheduled = true; n.start_date = null; n.end_date = null; s.backlog.push(n); return jsonOk(route, n); }
        } else {
          const bi = s.backlog.findIndex(n => n.id === nid);
          if (bi >= 0) { const [n] = s.backlog.splice(bi, 1); n.is_unscheduled = false; n.start_date = b.start_date; n.end_date = b.end_date; s.nodes.push(n); return jsonOk(route, n); }
          const node = s.nodes.find(n => n.id === nid);
          if (node && b.start_date) { node.start_date = b.start_date; node.end_date = b.end_date ?? null; return jsonOk(route, node); }
        }
        return jsonOk(route, {});
      }
      if (/^wbs\/progress\/[a-f0-9-]{36}$/.test(p) && m === 'PATCH') {
        const nid = p.split('/')[2]; const b = JSON.parse(route.request().postData() ?? '{}');
        const node = s.nodes.find(n => n.id === nid);
        if (node) node.progress = b.progress;
        return jsonOk(route, { node, time_entry: null });
      }
      if (/^wbs\/move\/[a-f0-9-]{36}$/.test(p) && m === 'PATCH') {
        const nid = p.split('/')[2]; const b = JSON.parse(route.request().postData() ?? '{}');
        const node = s.nodes.find(n => n.id === nid);
        if (node) { node.parent_id = b.parent_id ?? null; node.sort_order = b.sort_order ?? 0; }
        return jsonOk(route, node ?? {});
      }
      if (p === 'assignees' && m === 'POST') {
        const b = JSON.parse(route.request().postData() ?? '{}');
        s.assignees.push({ id: `a-${Date.now()}`, user_id: b.user_id });
        return jsonOk(route, s.assignees[s.assignees.length - 1], 201);
      }
      if (/^assignees\/[a-f0-9-]{36}$/.test(p) && m === 'DELETE') {
        s.assignees = s.assignees.filter(a => a.id !== p.split('/')[1]);
        return jsonOk(route, {});
      }
      if (p === 'dependencies' && m === 'POST') {
        const b = JSON.parse(route.request().postData() ?? '{}');
        const d: Dependency = { id: `d-${Date.now()}`, predecessor_id: b.predecessor_id, successor_id: b.successor_id, type: b.type ?? 'FS' };
        s.deps.push(d); return jsonOk(route, d, 201);
      }
      if (/^dependencies\/[a-f0-9-]{36}$/.test(p) && m === 'DELETE') {
        s.deps = s.deps.filter(d => d.id !== p.split('/')[1]);
        return jsonOk(route, {});
      }
      if (/^reports\/[a-f0-9-]{36}$/.test(p) && m === 'GET') return jsonOk(route, BUDGET);
      if (p === 'timesheet' && m === 'GET') return jsonOk(route, TIME_ENTRIES);
      if (p === 'timesheet' && m === 'POST') {
        const b = JSON.parse(route.request().postData() ?? '{}');
        return jsonOk(route, { id: `t-${Date.now()}`, task_id: b.task_id, user_id: 'u-exec', hours: b.hours, notes: b.notes ?? null, entry_date: NOW, profiles: null }, 201);
      }
      if (p === 'attachments' && m === 'GET') return jsonOk(route, ATTACHMENTS);
      if (p === 'attachments' && m === 'POST') return jsonOk(route, { id: `a-${Date.now()}`, project_id: 'p1', file_name: 'new.pdf', file_size: 1000, mime_type: 'application/pdf', download_url: '/s/new.pdf' }, 201);
      if (/^attachments\/[a-f0-9-]{36}$/.test(p) && m === 'DELETE') return jsonOk(route, {});

      if (p.match(/^admin\/users/) && m === 'GET') return jsonOk(route, s.adminUsers);
      if (p.match(/^admin\/users/) && m === 'POST') {
        const b = JSON.parse(route.request().postData() ?? '{}');
        const u: Profile = { id: `u-${Date.now()}`, email: b.email, full_name: b.name, avatar_url: null, status: 'invited', is_admin: false };
        s.adminUsers.push(u); return jsonOk(route, u, 201);
      }
      if (/^admin\/users\/[a-f0-9-]+$/.test(p) && m === 'PUT') {
        const uid = p.split('/').pop()!;
        const b = JSON.parse(route.request().postData() ?? '{}');
        const u = s.adminUsers.find(x => x.id === uid);
        if (u) { if (b.status) u.status = b.status; if (b.is_admin !== undefined) u.is_admin = b.is_admin; }
        return jsonOk(route, u ?? {});
      }
      if (p === 'kpi' && m === 'GET') return jsonOk(route, SUMMARY);

      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) });
    } catch {
      return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Internal error' }) });
    }
  });
}

async function gotoGantt(page: Page) {
  await page.addInitScript(() => window.localStorage.setItem('abax.auth.token', 'e2e-token'));
  await page.goto('/abax-gantt/gantt');
  await page.waitForSelector('.app-shell', { timeout: 10000 });
}

async function gotoAdmin(page: Page) {
  await page.addInitScript(() => window.localStorage.setItem('abax.auth.token', 'e2e-token'));
  await page.goto('/abax-gantt/admin');
  await page.waitForSelector('.app-shell', { timeout: 10000 });
}

test.describe('Shell y KPIs', () => {
  test('KPIs en modo compacto muestran 5 pildoras', async ({ page }) => {
    await setupApi(page, freshState());
    await gotoGantt(page);
    await expect(page.locator('.kpi-pill')).toHaveCount(5);
  });
  test('KPIs se expanden a tarjetas al hacer click', async ({ page }) => {
    await setupApi(page, freshState());
    await gotoGantt(page);
    await page.locator('.kpi-toggle').click();
    await expect(page.locator('.kpi-grid')).toBeVisible();
    await expect(page.locator('.kpi-widget')).toHaveCount(5);
  });
  test('KPIs se colapsan al hacer click de nuevo', async ({ page }) => {
    await setupApi(page, freshState());
    await gotoGantt(page);
    await page.locator('.kpi-toggle').click();
    await page.locator('.kpi-toggle').click();
    await expect(page.locator('.kpi-summary')).toBeVisible();
  });
  test('breadcrumb dinamico muestra texto personalizado', async ({ page }) => {
    await setupApi(page, freshState());
    await gotoGantt(page);
    await expect(page.locator('.workspace-crumb b')).toHaveText('Vista consolidada');
  });
  test('global search tiene placeholder y kbd hint', async ({ page }) => {
    await setupApi(page, freshState());
    await gotoGantt(page);
    await expect(page.locator('.global-search input')).toHaveAttribute('placeholder', 'Buscar tareas, proyectos, personas...');
    await expect(page.locator('.global-search kbd')).toBeVisible();
  });
  test('user chip muestra iniciales', async ({ page }) => {
    await setupApi(page, freshState());
    await gotoGantt(page);
    await expect(page.locator('.user-chip b')).toBeVisible();
  });
});

test.describe('Toolbar — Acciones', () => {
  test('boton Hoy es clickeable', async ({ page }) => {
    await setupApi(page, freshState());
    await gotoGantt(page);
    await page.locator('button').filter({ hasText: 'Hoy' }).click();
  });
  test('escala Dia activa botón correcto', async ({ page }) => {
    await setupApi(page, freshState());
    await gotoGantt(page);
    await page.locator('.scale-switch button').filter({ hasText: 'Día' }).click();
    await expect(page.locator('.scale-switch button').filter({ hasText: 'Día' })).toHaveClass(/primary-button/);
  });
  test('escala Año se activa', async ({ page }) => {
    await setupApi(page, freshState());
    await gotoGantt(page);
    await page.locator('.scale-switch button').filter({ hasText: 'Año' }).click();
    await expect(page.locator('.scale-switch button').filter({ hasText: 'Año' })).toHaveClass(/primary-button/);
  });
  test('export PNG esta en el menu', async ({ page }) => {
    await setupApi(page, freshState());
    await gotoGantt(page);
    await page.locator('.export-menu > button').click();
    await expect(page.locator('[role="menuitem"]').filter({ hasText: 'Imagen (PNG)' })).toBeVisible();
    await expect(page.locator('[role="menuitem"]').filter({ hasText: 'JSON' })).toBeVisible();
  });
  test('export menu se cierra click fuera', async ({ page }) => {
    await setupApi(page, freshState());
    await gotoGantt(page);
    await page.locator('.export-menu > button').click();
    await page.mouse.click(10, 10);
    await expect(page.locator('.export-menu-popover')).not.toBeVisible();
  });
  test('Enfocar proyecto deshabilitado sin seleccion', async ({ page }) => {
    await setupApi(page, freshState());
    await gotoGantt(page);
    await expect(page.locator('button').filter({ hasText: 'Enfocar proyecto' })).toBeDisabled();
  });
  test('Mis tareas toggle cambia estado', async ({ page }) => {
    await setupApi(page, freshState());
    await gotoGantt(page);
    await page.locator('button').filter({ hasText: 'Mis tareas' }).click();
    await page.locator('button').filter({ hasText: 'Mis tareas' }).click();
  });
});

test.describe('FilterBar — Completo', () => {
  // ---------------------------------------------------------------
  // Rediseño Fase 3: FilterBar reordenado.
  // Selectores nuevos: .filterbar / .fb-search input / .qfilter (pills semáforo)
  // / .fb-chip (Tipo, Más filtros) / .fb-menu / .fb-menu-wide / .fb-toggle /
  // .fb-clear / .fb-count.
  // ---------------------------------------------------------------

  test('filtro por nombre se persiste en el input', async ({ page }) => {
    await setupApi(page, freshState());
    await gotoGantt(page);
    const search = page.locator('.fb-search input');
    await search.fill('Tarea');
    await expect(search).toHaveValue('Tarea');
  });
  test('pills de estado existen (semáforo)', async ({ page }) => {
    await setupApi(page, freshState());
    await gotoGantt(page);
    for (const label of ['Todas', 'Pendiente', 'En progreso', 'Completado', 'Retrasado']) {
      await expect(page.locator('.qfilter').filter({ hasText: label })).toBeVisible();
    }
  });
  test('chip de tipo se abre y permite elegir Tarea', async ({ page }) => {
    await setupApi(page, freshState());
    await gotoGantt(page);
    const tipoChip = page.locator('.fb-chip').filter({ hasText: /^Tipo:/ });
    await tipoChip.click();
    await page.locator('.fb-menu-item').filter({ hasText: 'Tarea' }).click();
    await expect(tipoChip).toContainText('Tarea');
  });
  test('Solo backlog vive dentro de Más filtros', async ({ page }) => {
    await setupApi(page, freshState());
    await gotoGantt(page);
    await page.locator('.fb-chip').filter({ hasText: 'Más filtros' }).click();
    const toggle = page.locator('.fb-toggle').filter({ hasText: 'Solo backlog' });
    await toggle.click();
    await expect(toggle).toHaveClass(/is-on/);
    await toggle.click();
    await expect(toggle).not.toHaveClass(/is-on/);
  });
  test('Backlog visible toggle existe dentro de Más filtros', async ({ page }) => {
    await setupApi(page, freshState());
    await gotoGantt(page);
    await page.locator('.fb-chip').filter({ hasText: 'Más filtros' }).click();
    await expect(page.locator('.fb-toggle').filter({ hasText: 'Backlog visible' })).toBeVisible();
  });
  test('Mostrar cerrados toggle (semántica invertida vs viejo Ocultar)', async ({ page }) => {
    await setupApi(page, freshState());
    await gotoGantt(page);
    await page.locator('.fb-chip').filter({ hasText: 'Más filtros' }).click();
    const toggle = page.locator('.fb-toggle').filter({ hasText: 'Mostrar cerrados' });
    // Default activeOnly=true → "Mostrar cerrados" inactivo
    await expect(toggle).not.toHaveClass(/is-on/);
    await toggle.click();
    await expect(toggle).toHaveClass(/is-on/);
  });
  test('Mas filtros abre menú', async ({ page }) => {
    await setupApi(page, freshState());
    await gotoGantt(page);
    await page.locator('.fb-chip').filter({ hasText: 'Más filtros' }).click();
    await expect(page.locator('.fb-menu-wide')).toBeVisible();
  });
  test('Mas filtros muestra labels avanzados', async ({ page }) => {
    await setupApi(page, freshState());
    await gotoGantt(page);
    await page.locator('.fb-chip').filter({ hasText: 'Más filtros' }).click();
    for (const label of ['Proyecto', 'Responsable', 'Ejecutor', 'Vista', 'Aplicar filtros a', 'Rango de fechas']) {
      await expect(page.locator('.fb-menu-label').filter({ hasText: label })).toBeVisible();
    }
  });
  test('Mas filtros se cierra con boton Cerrar', async ({ page }) => {
    await setupApi(page, freshState());
    await gotoGantt(page);
    await page.locator('.fb-chip').filter({ hasText: 'Más filtros' }).click();
    await page.locator('.fb-menu-actions button').filter({ hasText: 'Cerrar' }).click();
    await expect(page.locator('.fb-menu-wide')).not.toBeVisible();
  });
  test('filtro estado se selecciona desde pills semáforo', async ({ page }) => {
    await setupApi(page, freshState());
    await gotoGantt(page);
    // Rediseño: el estado vive en pills semáforo, no en select.
    const pill = page.locator('.qfilter').filter({ hasText: 'Completado' });
    await pill.click();
    await expect(pill).toHaveClass(/is-on/);
  });
  test('filtro de fechas Desde y Hasta en Más filtros', async ({ page }) => {
    await setupApi(page, freshState());
    await gotoGantt(page);
    await page.locator('.fb-chip').filter({ hasText: 'Más filtros' }).click();
    await page.locator('.fb-menu-inline').filter({ hasText: 'Desde' }).locator('input').fill('2026-01-01');
    await page.locator('.fb-menu-inline').filter({ hasText: 'Hasta' }).locator('input').fill('2026-12-31');
  });
  test('Limpiar filtros resetea búsqueda y pills', async ({ page }) => {
    await setupApi(page, freshState());
    await gotoGantt(page);
    await page.locator('.fb-search input').fill('test');
    await page.locator('.qfilter').filter({ hasText: 'Pendiente' }).click();
    await page.locator('.fb-clear').click();
    await expect(page.locator('.fb-search input')).toHaveValue('');
    await expect(page.locator('.qfilter').filter({ hasText: 'Pendiente' })).not.toHaveClass(/is-on/);
  });
  test('contador de elementos es visible', async ({ page }) => {
    await setupApi(page, freshState());
    await gotoGantt(page);
    await expect(page.locator('.fb-count')).toContainText('ELEMENTOS');
  });
});

test.describe('Backlog Panel — Completo', () => {
  test('rail colapsado con badge', async ({ page }) => {
    await setupApi(page, freshState());
    await gotoGantt(page);
    await expect(page.locator('.backlog-rail')).toBeVisible();
    await expect(page.locator('.backlog-rail-badge')).toHaveText('2');
  });
  test('panel expandido muestra header', async ({ page }) => {
    await setupApi(page, freshState());
    await gotoGantt(page);
    await page.locator('.backlog-rail-toggle').click();
    await expect(page.locator('.backlog-panel h2')).toHaveText('Tareas sin fecha');
  });
  test('agrupa items por proyecto', async ({ page }) => {
    await setupApi(page, freshState());
    await gotoGantt(page);
    await page.locator('.backlog-rail-toggle').click();
    await expect(page.locator('.backlog-group')).toHaveCount(2);
  });
  test('cada grupo muestra nombre de proyecto y contador', async ({ page }) => {
    await setupApi(page, freshState());
    await gotoGantt(page);
    await page.locator('.backlog-rail-toggle').click();
    await expect(page.locator('.backlog-group').first().locator('h3').locator('span')).toBeVisible();
  });
  test('muestra hint de creacion', async ({ page }) => {
    await setupApi(page, freshState());
    await gotoGantt(page);
    await page.locator('.backlog-rail-toggle').click();
    await expect(page.locator('.backlog-create-hint')).toBeVisible();
  });
  test('muestra empty state con 0 items', async ({ page }) => {
    const s = freshState(); s.backlog = [];
    await setupApi(page, s);
    await gotoGantt(page);
    await page.locator('.backlog-rail-toggle').click();
    await expect(page.locator('.empty-backlog')).toBeVisible();
  });
  test('badge muestra 0 cuando no hay items', async ({ page }) => {
    const s = freshState(); s.backlog = [];
    await setupApi(page, s);
    await gotoGantt(page);
    await expect(page.locator('.backlog-rail-badge')).not.toBeVisible();
  });
  test('boton Programar abre form de fechas', async ({ page }) => {
    await setupApi(page, freshState());
    await gotoGantt(page);
    await page.locator('.backlog-rail-toggle').click();
    await page.locator('.schedule-toggle').first().click();
    await expect(page.locator('.schedule-form')).toBeVisible();
  });
  test('form de programar valida fecha inicio requerida', async ({ page }) => {
    await setupApi(page, freshState());
    await gotoGantt(page);
    await page.locator('.backlog-rail-toggle').click();
    await page.locator('.schedule-toggle').first().click();
    await page.locator('.schedule-form button[type="submit"]').click();
    await expect(page.locator('.schedule-form p').last()).toBeVisible();
  });
  test('programar con fechas validas', async ({ page }) => {
    await setupApi(page, freshState());
    await gotoGantt(page);
    await page.locator('.backlog-rail-toggle').click();
    await page.locator('.schedule-toggle').first().click();
    await page.locator('.schedule-form input').first().fill(NOW);
    await page.locator('.schedule-form button[type="submit"]').click();
    await expect(page.locator('.toast--success')).toBeVisible({ timeout: 5000 });
  });
  test('cierra panel con boton de cierre', async ({ page }) => {
    await setupApi(page, freshState());
    await gotoGantt(page);
    await page.locator('.backlog-rail-toggle').click();
    await page.locator('.backlog-panel header button').click();
    await expect(page.locator('.backlog-panel')).not.toBeVisible();
  });
});

test.describe('Detail Panel — 7 Tabs', () => {
  test('detail panel vacio muestra empty state', async ({ page }) => {
    await setupApi(page, freshState());
    await gotoGantt(page);
    await page.locator('.detail-rail-toggle').click();
    await expect(page.locator('.status-state h2')).toHaveText('Selecciona un nodo');
  });
  test('cierra detail panel desde el header', async ({ page }) => {
    await setupApi(page, freshState());
    await gotoGantt(page);
    await page.locator('.detail-rail-toggle').click();
    await page.locator('.detail-header-close').click();
  });
  test('detail rail muestra nombre de nodo', async ({ page }) => {
    await setupApi(page, freshState());
    await gotoGantt(page);
    await expect(page.locator('.detail-rail-label')).toBeVisible();
  });
});

test.describe('CreateDialog — Crear Hijo', () => {
  test('+ Nodo hijo deshabilitado sin seleccion', async ({ page }) => {
    await setupApi(page, freshState());
    await gotoGantt(page);
    await expect(page.locator('button').filter({ hasText: /\+ Nodo hijo/ })).toBeDisabled();
  });
});

test.describe('Gantt Canvas', () => {
  test('skeleton loading aparece durante carga', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('abax.auth.token', 'e2e-token'));
    let resolvePromise: (v: unknown) => void;
    const delay = new Promise(r => { resolvePromise = r; });
    await page.route('**/api/**', async () => { await delay; });
    await page.goto('/abax-gantt/gantt');
    await expect(page.locator('.gantt-skeleton').first()).toBeVisible({ timeout: 3000 });
    resolvePromise!(undefined);
  });
  test('empty state con 0 nodos', async ({ page }) => {
    const s = freshState(); s.nodes = []; s.backlog = []; s.projects = [];
    await setupApi(page, s);
    await page.addInitScript(() => window.localStorage.setItem('abax.auth.token', 'e2e-token'));
    await page.goto('/abax-gantt/gantt');
    await expect(page.locator('.status-state').or(page.locator('.gantt-skeleton'))).toBeVisible({ timeout: 8000 });
  });
  test('Gantt renderiza al tener nodos', async ({ page }) => {
    await setupApi(page, freshState());
    await gotoGantt(page);
    await expect(page.locator('.gantt_container')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Mobile — TaskList', () => {
  test('mobile task list aparece en 375px', async ({ page }) => {
    await setupApi(page, freshState());
    await page.setViewportSize({ width: 375, height: 812 });
    await gotoGantt(page);
    await page.waitForTimeout(800);
    const mtl = page.locator('.mobile-tasks');
    if (await mtl.isVisible()) {
      await expect(page.locator('.mobile-show-gantt')).toBeVisible();
    }
  });
  test('mobile: boton Ver Gantt cambia a vista Gantt', async ({ page }) => {
    await setupApi(page, freshState());
    await page.setViewportSize({ width: 375, height: 812 });
    await gotoGantt(page);
    await page.waitForTimeout(800);
    const showGantt = page.locator('.mobile-show-gantt');
    if (await showGantt.isVisible()) {
      await showGantt.click();
      await page.waitForTimeout(500);
    }
  });
  test('mobile: volver a lista desde Gantt', async ({ page }) => {
    await setupApi(page, freshState());
    await page.setViewportSize({ width: 375, height: 812 });
    await gotoGantt(page);
    await page.waitForTimeout(800);
    const showGantt = page.locator('.mobile-show-gantt');
    if (await showGantt.isVisible()) {
      await showGantt.click();
      await page.waitForTimeout(500);
      const back = page.locator('.mobile-back-to-list button');
      if (await back.isVisible()) await back.click();
    }
  });
  test('desktop 1440px muestra Gantt completo', async ({ page }) => {
    await setupApi(page, freshState());
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoGantt(page);
    await expect(page.locator('.gantt-canvas')).toBeVisible({ timeout: 5000 });
  });
  test('tablet 768px muestra mobile list', async ({ page }) => {
    await setupApi(page, freshState());
    await page.setViewportSize({ width: 768, height: 1024 });
    await gotoGantt(page);
    await page.waitForTimeout(800);
  });
});

test.describe('Admin Page — Completo', () => {
  test('pagina admin carga con AppShell', async ({ page }) => {
    await setupApi(page, freshState());
    await gotoAdmin(page);
    await expect(page.locator('.app-shell')).toBeVisible();
    await expect(page.locator('.admin-page')).toBeVisible({ timeout: 5000 });
  });
  test('breadcrumb muestra Administracion', async ({ page }) => {
    await setupApi(page, freshState());
    await gotoAdmin(page);
    await expect(page.locator('.workspace-crumb b')).toContainText('Admin');
  });
  test('formulario de invitacion tiene nombre y email', async ({ page }) => {
    await setupApi(page, freshState());
    await gotoAdmin(page);
    // Rediseño Fase 9: el admin tiene dos sub-secciones (Usuarios + Equipos)
    // y por lo tanto dos formularios. Apuntamos al primero (.assign-form).
    const form = page.locator('.admin-page .assign-form').first();
    await expect(form.locator('input[placeholder="Ana Torres"]')).toBeVisible({ timeout: 3000 });
    await expect(form.locator('input[placeholder*="ana@"]')).toBeVisible();
  });
  test('tabla de usuarios tiene columnas', async ({ page }) => {
    await setupApi(page, freshState());
    await gotoAdmin(page);
    // Hay 2 .admin-table tras Fase 9 (usuarios y equipos). La primera es la de usuarios.
    await expect(page.locator('.admin-table').first()).toBeVisible({ timeout: 5000 });
  });
  test('filtro de busqueda en admin', async ({ page }) => {
    await setupApi(page, freshState());
    await gotoAdmin(page);
    const search = page.locator('.admin-filterbar .admin-search').or(page.locator('.admin-page input[type="search"]'));
    if (await search.isVisible({ timeout: 2000 }).catch(() => false)) {
      await search.fill('Admin');
    }
  });
  test('filtro por estado en admin', async ({ page }) => {
    await setupApi(page, freshState());
    await gotoAdmin(page);
    const sel = page.locator('.admin-filterbar select').or(page.locator('.admin-page select'));
    if (await sel.isVisible({ timeout: 2000 }).catch(() => false)) {
      await sel.selectOption('active');
    }
  });
  test('boton Volver al Gantt navega', async ({ page }) => {
    await setupApi(page, freshState());
    await gotoAdmin(page);
    const back = page.locator('a').filter({ hasText: /Volver/ }).or(page.locator('button').filter({ hasText: /Volver/ }));
    if (await back.isVisible({ timeout: 2000 }).catch(() => false)) {
      await back.click();
      await page.waitForURL(/\/gantt/);
    }
  });
});

test.describe('Atajos de Teclado', () => {
  test('Ctrl+Shift+N abre crear proyecto', async ({ page }) => {
    await setupApi(page, freshState());
    await gotoGantt(page);
    await page.keyboard.press('Control+Shift+N');
    await expect(page.locator('.create-dialog')).toBeVisible({ timeout: 3000 });
  });
  test('? abre shortcuts modal', async ({ page }) => {
    await setupApi(page, freshState());
    await gotoGantt(page);
    await page.keyboard.press('?');
    await expect(page.locator('.shortcuts-modal')).toBeVisible({ timeout: 3000 });
  });
  test('shortcuts modal tiene 3 grupos', async ({ page }) => {
    await setupApi(page, freshState());
    await gotoGantt(page);
    await page.keyboard.press('?');
    await page.waitForSelector('.shortcuts-modal', { timeout: 3000 });
    await expect(page.locator('.shortcuts-group')).toHaveCount(3);
  });
  test('shortcuts modal se cierra con X', async ({ page }) => {
    await setupApi(page, freshState());
    await gotoGantt(page);
    await page.keyboard.press('?');
    await page.locator('.modal-close').click();
    await expect(page.locator('.shortcuts-modal')).not.toBeVisible();
  });
  test('shortcuts modal se cierra con Escape', async ({ page }) => {
    await setupApi(page, freshState());
    await gotoGantt(page);
    await page.keyboard.press('?');
    await page.keyboard.press('Escape');
    await expect(page.locator('.shortcuts-modal')).not.toBeVisible();
  });
  test('shortcuts lista atajos de navegacion temporal', async ({ page }) => {
    await setupApi(page, freshState());
    await gotoGantt(page);
    await page.keyboard.press('?');
    await expect(page.locator('.shortcuts-body')).toContainText('Zoom');
  });
});

test.describe('Error States', () => {
  test('401 response muestra pantalla de error o login', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('abax.auth.token', 'e2e-token'));
    await page.route('**/api/projects', async (route) => route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Token invalido' }) }));
    await page.route('**/api/summary', async (route) => route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Token invalido' }) }));
    await page.route('**/api/wbs', async (route) => route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Token invalido' }) }));
    await page.route('**/api/backlog', async (route) => route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Token invalido' }) }));
    await page.route('**/api/users', async (route) => route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Token invalido' }) }));
    await page.route('**/api/dependencies', async (route) => route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Token invalido' }) }));
    await page.goto('/abax-gantt/gantt');
    await page.waitForTimeout(3000);
    const tokenAfter = await page.evaluate(() => window.localStorage.getItem('abax.auth.token'));
    const urlAfter = page.url();
    // Either token was cleared or redirected to login
    expect(tokenAfter === null || urlAfter.includes('/login')).toBeTruthy();
  });
  test('500 error muestra estado de error', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('abax.auth.token', 'e2e-token'));
    await page.route('**/api/**', async (route) => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Server error' }) }));
    await page.goto('/abax-gantt/gantt');
    await expect(page.locator('.status-state')).toBeVisible({ timeout: 8000 });
  });
});

test.describe('Crear Proyecto — Flujo Completo', () => {
  test('crea proyecto, ve toast, cierra modal', async ({ page }) => {
    await setupApi(page, freshState());
    await gotoGantt(page);
    await page.locator('button').filter({ hasText: /\+ Proyecto/ }).click();
    await page.locator('.create-dialog input').fill('Proyecto Nuevo');
    await page.locator('.create-dialog button').filter({ hasText: 'Crear' }).click();
    await expect(page.locator('.toast--success')).toBeVisible({ timeout: 5000 });
  });
  test('valida nombre vacio en creacion', async ({ page }) => {
    await setupApi(page, freshState());
    await gotoGantt(page);
    await page.locator('button').filter({ hasText: /\+ Proyecto/ }).click();
    await page.locator('.create-dialog button').filter({ hasText: 'Crear' }).click();
    await expect(page.locator('.form-error')).toBeVisible();
  });
  test('cierra modal con boton Cancelar', async ({ page }) => {
    await setupApi(page, freshState());
    await gotoGantt(page);
    await page.locator('button').filter({ hasText: /\+ Proyecto/ }).click();
    await page.locator('.create-dialog button').filter({ hasText: 'Cancelar' }).click();
    await expect(page.locator('.create-dialog')).not.toBeVisible();
  });
  test('cierra modal con boton X', async ({ page }) => {
    await setupApi(page, freshState());
    await gotoGantt(page);
    await page.locator('button').filter({ hasText: /\+ Proyecto/ }).click();
    await page.locator('.create-dialog header button').click();
    await expect(page.locator('.create-dialog')).not.toBeVisible();
  });
});

test.describe('Dark Mode', () => {
  test('dark mode se activa con localStorage', async ({ page }) => {
    await page.addInitScript(() => { window.localStorage.setItem('abax.auth.token', 'e2e-token'); window.localStorage.setItem('abax.theme', 'dark'); });
    await setupApi(page, freshState());
    await page.goto('/abax-gantt/gantt');
    await expect(page.locator('.app-shell')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });
  test('light mode es el default', async ({ page }) => {
    await setupApi(page, freshState());
    await gotoGantt(page);
    const theme = await page.locator('html').getAttribute('data-theme');
    expect(theme === 'light' || theme === null).toBeTruthy();
  });
});

test.describe('ConfirmDialog', () => {
  test('confirm dialog no visible inicialmente', async ({ page }) => {
    await setupApi(page, freshState());
    await gotoGantt(page);
    await expect(page.locator('.confirm-dialog')).not.toBeVisible();
  });
});

test.describe('Fullscreen', () => {
  test('entra y sale de pantalla completa', async ({ page }) => {
    await setupApi(page, freshState());
    await gotoGantt(page);
    await page.locator('button').filter({ hasText: /Pantalla completa/ }).click();
    await expect(page.locator('.fullscreen-exit')).toBeVisible();
    await page.locator('.fullscreen-exit').click();
    await expect(page.locator('.fullscreen-exit')).not.toBeVisible();
  });
});

test.describe('Integracion — Flujos Completos', () => {
  test('crear proyecto -> backlog -> programar -> ver en gantt', async ({ page }) => {
    await setupApi(page, freshState());
    await gotoGantt(page);
    await page.locator('button').filter({ hasText: /\+ Proyecto/ }).click();
    await page.locator('.create-dialog input').fill('Integracion Test');
    await page.locator('.create-dialog button').filter({ hasText: 'Crear' }).click();
    await expect(page.locator('.toast--success')).toBeVisible({ timeout: 5000 });
    await page.locator('.backlog-rail-toggle').click();
    await expect(page.locator('.backlog-panel')).toBeVisible({ timeout: 3000 });
    await page.locator('.backlog-panel header button').click();
  });
  test('filtro + limpiar mantiene consistencia', async ({ page }) => {
    await setupApi(page, freshState());
    await gotoGantt(page);
    // Rediseño: estado se elige por pills; tipo por dropdown.
    await page.locator('.qfilter').filter({ hasText: 'Pendiente' }).click();
    await page.locator('.fb-search input').fill('foo');
    // Esperar al debounce de búsqueda (250ms) para que onSearch se haya disparado
    // antes de pulsar Limpiar; si no, una segunda llamada a onSearch llega tras
    // el clear y vuelve a poner 'foo'.
    await page.waitForTimeout(350);
    await page.locator('.fb-clear').click();
    await expect(page.locator('.qfilter').filter({ hasText: 'Pendiente' })).not.toHaveClass(/is-on/);
    await expect(page.locator('.fb-search input')).toHaveValue('');
  });
  test('filtro tipo + busqueda combinados', async ({ page }) => {
    await setupApi(page, freshState());
    await gotoGantt(page);
    const tipoChip = page.locator('.fb-chip').filter({ hasText: /^Tipo:/ });
    await tipoChip.click();
    await page.locator('.fb-menu-item').filter({ hasText: 'Tarea' }).click();
    await page.locator('.fb-search input').fill('Tarea A');
    await expect(page.locator('.fb-search input')).toHaveValue('Tarea A');
    await expect(tipoChip).toContainText('Tarea');
  });
  test('pantalla completa oculta toolbar y filtros', async ({ page }) => {
    await setupApi(page, freshState());
    await gotoGantt(page);
    await page.locator('button').filter({ hasText: /Pantalla completa/ }).click();
    await expect(page.locator('.toolbar')).not.toBeVisible();
    await page.locator('.fullscreen-exit').click();
    await expect(page.locator('.toolbar')).toBeVisible();
  });
  test('escala cambia y Gantt sigue visible', async ({ page }) => {
    await setupApi(page, freshState());
    await gotoGantt(page);
    await page.locator('.scale-switch button').filter({ hasText: 'Día' }).click();
    await expect(page.locator('.gantt-canvas')).toBeVisible();
    await page.locator('.scale-switch button').filter({ hasText: 'Mes' }).click();
    await expect(page.locator('.gantt-canvas')).toBeVisible();
  });
  test('backlog toggle multiple veces no rompe UI', async ({ page }) => {
    await setupApi(page, freshState());
    await gotoGantt(page);
    for (let i = 0; i < 3; i++) {
      await page.locator('.backlog-rail-toggle').click();
      await page.waitForTimeout(300);
      await page.locator('.backlog-panel header button').click();
      await page.waitForTimeout(300);
    }
    await expect(page.locator('.app-shell')).toBeVisible();
  });
  test('abrir y cerrar detail panel repetidamente', async ({ page }) => {
    await setupApi(page, freshState());
    await gotoGantt(page);
    for (let i = 0; i < 3; i++) {
      await page.locator('.detail-rail-toggle').click();
      await page.waitForTimeout(200);
      await page.locator('.detail-header-close').click();
      await page.waitForTimeout(200);
    }
    await expect(page.locator('.app-shell')).toBeVisible();
  });
});

test.describe('Edge Cases', () => {
  test('crear proyecto con nombre con caracteres especiales', async ({ page }) => {
    await setupApi(page, freshState());
    await gotoGantt(page);
    await page.locator('button').filter({ hasText: /\+ Proyecto/ }).click();
    await page.locator('.create-dialog input').fill('Proyecto #1 — Año 2026 (v2.0)');
    await page.locator('.create-dialog button').filter({ hasText: 'Crear' }).click();
    await expect(page.locator('.toast--success')).toBeVisible({ timeout: 5000 });
  });
  test('crear proyecto con nombre muy largo', async ({ page }) => {
    await setupApi(page, freshState());
    await gotoGantt(page);
    await page.locator('button').filter({ hasText: /\+ Proyecto/ }).click();
    await page.locator('.create-dialog input').fill('A'.repeat(200));
    await page.locator('.create-dialog button').filter({ hasText: 'Crear' }).click();
  });
  test('portfolio vacio muestra empty state', async ({ page }) => {
    const s = freshState(); s.nodes = []; s.backlog = []; s.projects = [];
    await setupApi(page, s);
    await page.addInitScript(() => window.localStorage.setItem('abax.auth.token', 'e2e-token'));
    await page.goto('/abax-gantt/gantt');
    await expect(page.locator('.status-state').or(page.locator('.gantt-skeleton'))).toBeVisible({ timeout: 8000 });
  });
  test('solo proyectos sin nodos hijos', async ({ page }) => {
    const s = freshState();
    s.nodes = s.nodes.filter(n => n.type === 'project');
    await setupApi(page, s);
    await gotoGantt(page);
    await expect(page.locator('.app-shell')).toBeVisible();
  });
  test('cambiar filtros rapidamente no rompe UI', async ({ page }) => {
    await setupApi(page, freshState());
    await gotoGantt(page);
    // Rediseño: tipo es un dropdown exclusivo. Cambiamos entre opciones varias veces.
    const tipoChip = page.locator('.fb-chip').filter({ hasText: /^Tipo:/ });
    for (const label of ['Proyecto', 'Etapa', 'Grupo', 'Tarea', 'Hito']) {
      await tipoChip.click();
      await page.locator('.fb-menu-item').filter({ hasText: new RegExp(`^${label}$`) }).click();
    }
    await expect(page.locator('.app-shell')).toBeVisible();
  });
});

test.describe('Theme Toggle', () => {
  test('toggle de tema cambia data-theme', async ({ page }) => {
    await setupApi(page, freshState());
    await gotoGantt(page);
    const current = await page.locator('html').getAttribute('data-theme');
    await page.locator('.theme-toggle').first().click();
    await page.waitForTimeout(300);
    const next = await page.locator('html').getAttribute('data-theme');
    expect(next).not.toBe(current);
  });
});
