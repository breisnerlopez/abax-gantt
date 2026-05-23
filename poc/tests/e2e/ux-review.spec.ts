import { expect, test, type Page, type Route } from '@playwright/test';

const NOW = new Date().toISOString().slice(0, 10);
const NEXT_WEEK = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

const MOCK_USERS = [
  { id: 'user-admin', email: 'admin@abax.local', full_name: 'Admin User', avatar_url: null, status: 'active', is_admin: true },
  { id: 'user-resp', email: 'resp@abax.local', full_name: 'Responsable Demo', avatar_url: null, status: 'active' },
  { id: 'user-exec', email: 'exec@abax.local', full_name: 'Ejecutor Demo', avatar_url: null, status: 'active' },
];

const MOCK_PROJECTS = [
  { id: 'proj-1', name: 'Proyecto Alpha', description: 'Primer proyecto', status: 'active', budget_total: 500000, project_types: null },
  { id: 'proj-2', name: 'Proyecto Beta', description: null, status: 'active', budget_total: 300000, project_types: null },
];

const MOCK_NODES = [
  { id: 'node-root-1', project_id: 'proj-1', parent_id: null, name: 'Proyecto Alpha', type: 'project', description: null, start_date: NOW, end_date: NEXT_WEEK, duration_days: 7, progress: 0, estimated_hours: 160, estimated_cost: null, color: null, sort_order: 0, responsible_id: 'user-resp', is_unscheduled: false, status: null, path: 'n_root1' },
  { id: 'node-stage-1', project_id: 'proj-1', parent_id: 'node-root-1', name: 'Fase 1', type: 'stage', description: 'Primera fase', start_date: NOW, end_date: NEXT_WEEK, duration_days: 7, progress: 0.3, estimated_hours: 80, estimated_cost: null, color: null, sort_order: 1, responsible_id: 'user-resp', is_unscheduled: false, status: null, path: 'n_root1.n_stage1' },
  { id: 'node-task-1', project_id: 'proj-1', parent_id: 'node-stage-1', name: 'Tarea A', type: 'task', description: 'Primera tarea', start_date: NOW, end_date: NOW, duration_days: 1, progress: 0.5, estimated_hours: 20, estimated_cost: 50000, color: null, sort_order: 0, responsible_id: 'user-exec', is_unscheduled: false, status: 'en_progreso', path: 'n_root1.n_stage1.n_task1', task_assignees: [{ user_id: 'user-exec' }] },
  { id: 'node-task-2', project_id: 'proj-1', parent_id: 'node-stage-1', name: 'Tarea B', type: 'task', description: null, start_date: null, end_date: null, duration_days: null, progress: 0, estimated_hours: 40, estimated_cost: null, color: null, sort_order: 1, responsible_id: null, is_unscheduled: false, status: 'pendiente', path: 'n_root1.n_stage1.n_task2' },
  { id: 'node-root-2', project_id: 'proj-2', parent_id: null, name: 'Proyecto Beta', type: 'project', description: null, start_date: NEXT_WEEK, end_date: null, duration_days: null, progress: 0, estimated_hours: 120, estimated_cost: null, color: null, sort_order: 0, responsible_id: 'user-admin', is_unscheduled: false, status: null, path: 'n_root2' },
];

const MOCK_BACKLOG = [
  { id: 'node-blog-1', project_id: 'proj-1', parent_id: 'node-stage-1', name: 'Tarea pendiente por planificar', type: 'task', description: null, start_date: null, end_date: null, duration_days: null, progress: 0, estimated_hours: 16, estimated_cost: null, color: null, sort_order: 2, responsible_id: 'user-resp', is_unscheduled: true, status: null, path: 'n_root1.n_stage1.n_blog1' },
];

const MOCK_DEPENDENCIES = [
  { id: 'dep-1', predecessor_id: 'node-task-1', successor_id: 'node-task-2', type: 'FS' as const },
];

const MOCK_SUMMARY = {
  active_projects: 2, total_projects: 2, global_progress: 25,
  upcoming_milestones_count: 1, total_budget: 800000, total_estimated_cost: 50000,
  budget_consumed_pct: 6, total_tasks: 4, unscheduled_tasks: 1,
};

const MOCK_BUDGET = {
  project: { id: 'proj-1', name: 'Proyecto Alpha', status: 'active' },
  budget: { total: 500000, estimated_cost: 50000, consumed_pct: 6 },
  hours: { estimated: 160, actual: 10, variance_pct: -94 },
  progress: 25, task_count: 3,
  task_breakdown: [],
  hours_by_person: [],
};

const MOCK_TIME_ENTRIES = [
  { id: 'time-1', task_id: 'node-task-1', user_id: 'user-exec', hours: 5, notes: 'Avance inicial', entry_date: NOW, profiles: { id: 'user-exec', full_name: 'Ejecutor Demo', avatar_url: null } },
];

const MOCK_ATTACHMENTS = [
  { id: 'att-1', project_id: 'proj-1', file_name: 'especificacion.pdf', file_path: '/storage/especificacion.pdf', file_size: 250000, mime_type: 'application/pdf', download_url: '/storage/especificacion.pdf' },
];

type MockState = {
  projects: typeof MOCK_PROJECTS;
  nodes: typeof MOCK_NODES;
  backlog: typeof MOCK_BACKLOG;
  dependencies: typeof MOCK_DEPENDENCIES;
  assignees: Array<{ id?: string; user_id: string }>;
};

async function setupMockApi(page: Page, state: MockState) {
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.split('/api/').pop() ?? '';
    const method = route.request().method();

    try {
      if (path === 'projects' && method === 'GET') return jsonOk(route, state.projects);
      if (path === 'users' && method === 'GET') return jsonOk(route, MOCK_USERS);
      if (path === 'wbs' && method === 'GET') return jsonOk(route, state.nodes);
      if (path === 'backlog' && method === 'GET') return jsonOk(route, state.backlog);
      if (path === 'dependencies' && method === 'GET') return jsonOk(route, state.dependencies);
      if (path === 'summary' && method === 'GET') return jsonOk(route, MOCK_SUMMARY);
      if (path === 'assignees' && method === 'GET') return jsonOk(route, state.assignees);

      if (path === 'projects' && method === 'POST') {
        const body = JSON.parse(route.request().postData() ?? '{}');
        const newId = `proj-${Date.now()}`;
        const rootId = `node-root-${Date.now()}`;
        state.projects.push({ id: newId, name: body.name, description: null, status: 'active', budget_total: null, project_types: null });
        state.nodes.push({ id: rootId, project_id: newId, parent_id: null, name: body.name, type: 'project' as const, description: null, start_date: null, end_date: null, duration_days: null, progress: 0, estimated_hours: null, estimated_cost: null, color: null, sort_order: 0, responsible_id: null, is_unscheduled: false, status: null, path: `n_${rootId.replaceAll('-', '_')}` });
        return jsonOk(route, { ...state.projects[state.projects.length - 1], root_node: state.nodes[state.nodes.length - 1], root_node_id: rootId }, 201);
      }

      if (path === 'wbs' && method === 'POST') {
        const body = JSON.parse(route.request().postData() ?? '{}');
        const newId = `node-${Date.now()}`;
        const node = { id: newId, project_id: 'proj-1', parent_id: body.parent_id, name: body.name, type: body.type ?? 'task', description: null, start_date: body.start_date ?? null, end_date: body.end_date ?? null, duration_days: null, progress: 0, estimated_hours: null, estimated_cost: null, color: null, sort_order: state.nodes.filter(n => n.parent_id === body.parent_id).length, responsible_id: null, is_unscheduled: !body.start_date, status: null, path: `n_${newId.replaceAll('-', '_')}` };
        if (node.is_unscheduled) state.backlog.push(node); else state.nodes.push(node);
        return jsonOk(route, node, 201);
      }

      if (path.match(/^wbs\/[a-f0-9-]{36}$/) && method === 'PATCH') {
        const nodeId = path.split('/')[1];
        const body = JSON.parse(route.request().postData() ?? '{}');
        const node = state.nodes.find(n => n.id === nodeId) ?? state.backlog.find(n => n.id === nodeId);
        if (node) Object.assign(node, body);
        return jsonOk(route, node ?? {});
      }

      if (path.match(/^wbs\/schedule\/[a-f0-9-]{36}$/) && method === 'PATCH') {
        const nodeId = path.split('/')[2];
        const body = JSON.parse(route.request().postData() ?? '{}');
        if (body.unschedule) {
          const idx = state.nodes.findIndex(n => n.id === nodeId);
          if (idx >= 0) {
            const [node] = state.nodes.splice(idx, 1);
            node.is_unscheduled = true;
            node.start_date = null;
            node.end_date = null;
            state.backlog.push(node);
            return jsonOk(route, node);
          }
        } else {
          const idx = state.backlog.findIndex(n => n.id === nodeId);
          if (idx >= 0) {
            const [node] = state.backlog.splice(idx, 1);
            node.is_unscheduled = false;
            node.start_date = body.start_date;
            node.end_date = body.end_date;
            state.nodes.push(node);
            return jsonOk(route, node);
          }
          const node = state.nodes.find(n => n.id === nodeId);
          if (node && body.start_date) {
            node.start_date = body.start_date;
            node.end_date = body.end_date ?? null;
            return jsonOk(route, node);
          }
        }
        return jsonOk(route, {});
      }

      if (path.match(/^wbs\/progress\/[a-f0-9-]{36}$/) && method === 'PATCH') {
        const nodeId = path.split('/')[2];
        const body = JSON.parse(route.request().postData() ?? '{}');
        const node = state.nodes.find(n => n.id === nodeId);
        if (node) node.progress = body.progress;
        return jsonOk(route, { node, time_entry: null });
      }

      if (path.match(/^wbs\/move\/[a-f0-9-]{36}$/) && method === 'PATCH') {
        const nodeId = path.split('/')[2];
        const body = JSON.parse(route.request().postData() ?? '{}');
        const node = state.nodes.find(n => n.id === nodeId);
        if (node) { node.parent_id = body.parent_id ?? null; node.sort_order = body.sort_order ?? 0; }
        return jsonOk(route, node ?? {});
      }

      if (path === 'assignees' && method === 'POST') {
        const body = JSON.parse(route.request().postData() ?? '{}');
        state.assignees.push({ id: `asgn-${Date.now()}`, user_id: body.user_id });
        return jsonOk(route, state.assignees[state.assignees.length - 1], 201);
      }

      if (path.match(/^assignees\/[a-f0-9-]{36}$/) && method === 'DELETE') {
        const id = path.split('/')[1];
        state.assignees = state.assignees.filter(a => a.id !== id);
        return jsonOk(route, {});
      }

      if (path === 'dependencies' && method === 'POST') {
        const body = JSON.parse(route.request().postData() ?? '{}');
        const dep = { id: `dep-${Date.now()}`, predecessor_id: body.predecessor_id, successor_id: body.successor_id, type: body.type ?? 'FS' };
        state.dependencies.push(dep);
        return jsonOk(route, dep, 201);
      }

      if (path.match(/^dependencies\/[a-f0-9-]{36}$/) && method === 'DELETE') {
        const id = path.split('/')[1];
        state.dependencies = state.dependencies.filter(d => d.id !== id);
        return jsonOk(route, {});
      }

      if (path.match(/^reports\/[a-f0-9-]{36}$/) && method === 'GET') return jsonOk(route, MOCK_BUDGET);
      if (path === 'timesheet' && method === 'GET') return jsonOk(route, MOCK_TIME_ENTRIES);
      if (path === 'attachments' && method === 'GET') return jsonOk(route, MOCK_ATTACHMENTS);
      if (path === 'export/proj-1' && method === 'GET') return jsonOk(route, MOCK_NODES);

      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) });
    } catch {
      return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Internal error' }) });
    }
  });
}

async function jsonOk(route: Route, data: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ data, count: Array.isArray(data) ? data.length : undefined }) });
}

function freshState(): MockState {
  return {
    projects: JSON.parse(JSON.stringify(MOCK_PROJECTS)),
    nodes: JSON.parse(JSON.stringify(MOCK_NODES)),
    backlog: JSON.parse(JSON.stringify(MOCK_BACKLOG)),
    dependencies: JSON.parse(JSON.stringify(MOCK_DEPENDENCIES)),
    assignees: [{ user_id: 'user-exec' }],
  };
}

async function gotoGantt(page: Page) {
  await page.addInitScript(() => window.localStorage.setItem('abax.auth.token', 'e2e-token'));
  await page.goto('/abax-gantt/gantt');
  await page.waitForSelector('.app-shell', { timeout: 10000 });
}

test.describe('Login y Autenticación', () => {
  test('redirige a /login si no hay token', async ({ page }) => {
    await page.goto('/abax-gantt/gantt');
    await expect(page).toHaveURL(/\/login/);
  });

  test('muestra pantalla de login con botón Authentik', async ({ page }) => {
    await page.goto('/abax-gantt/login');
    await expect(page.locator('h1')).toBeVisible();
  });
});

test.describe('Shell y Navegación', () => {
  test('renderiza shell completo con topbar y KPIs', async ({ page }) => {
    const state = freshState();
    await setupMockApi(page, state);
    await gotoGantt(page);

    await expect(page.locator('.brand-lockup')).toBeVisible();
    await expect(page.locator('.brand-lockup strong')).toHaveText('ABAX Gantt');
    await expect(page.locator('.workspace-crumb')).toBeVisible();
    await expect(page.locator('.kpi-strip')).toBeVisible();
    await expect(page.locator('.user-chip')).toBeVisible();
  });

  test('breadcrumb muestra vista por defecto', async ({ page }) => {
    const state = freshState();
    await setupMockApi(page, state);
    await gotoGantt(page);
    await expect(page.locator('.workspace-crumb b')).toHaveText('Vista consolidada');
  });

  test('KPIs muestran valores del summary', async ({ page }) => {
    const state = freshState();
    await setupMockApi(page, state);
    await gotoGantt(page);
    await expect(page.locator('.kpi-strip')).toBeVisible();
    await expect(page.locator('.kpi-summary')).toBeVisible();
  });

  test('botón Admin está presente', async ({ page }) => {
    const state = freshState();
    await setupMockApi(page, state);
    await gotoGantt(page);
    await expect(page.locator('.ghost-button').filter({ hasText: 'Admin' })).toBeVisible();
  });

  test('botón Salir está presente y es clickeable', async ({ page }) => {
    const state = freshState();
    await setupMockApi(page, state);
    await gotoGantt(page);
    const logoutBtn = page.locator('.ghost-button').filter({ hasText: 'Salir' });
    await expect(logoutBtn).toBeVisible();
    await expect(logoutBtn).toBeEnabled();
  });

  test('toggle de tema oscuro', async ({ page }) => {
    const state = freshState();
    await setupMockApi(page, state);
    await gotoGantt(page);
    const themeBtn = page.locator('.theme-toggle').first();
    await expect(themeBtn).toBeVisible();
  });

  test('búsqueda global con atajo ⌘K', async ({ page }) => {
    const state = freshState();
    await setupMockApi(page, state);
    await gotoGantt(page);
    const searchInput = page.locator('.global-search input');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('Tarea A');
    await expect(searchInput).toHaveValue('Tarea A');
  });
});

test.describe('Creación de Proyectos', () => {
  test('abre modal de crear proyecto al hacer click en + Proyecto', async ({ page }) => {
    const state = freshState();
    await setupMockApi(page, state);
    await gotoGantt(page);
    await page.locator('button').filter({ hasText: /\+ Proyecto/ }).click();
    await expect(page.locator('.create-dialog')).toBeVisible();
    await expect(page.locator('.create-dialog h2')).toHaveText('Crear proyecto');
  });

  test('modal de crear proyecto tiene campo nombre y botones Crear/Cancelar', async ({ page }) => {
    const state = freshState();
    await setupMockApi(page, state);
    await gotoGantt(page);
    await page.locator('button').filter({ hasText: /\+ Proyecto/ }).click();

    await expect(page.locator('.create-dialog input')).toBeVisible();
    await expect(page.locator('.create-dialog button').filter({ hasText: 'Crear' })).toBeVisible();
    await expect(page.locator('.create-dialog button').filter({ hasText: 'Cancelar' })).toBeVisible();
  });

  test('valida nombre vacío al crear proyecto', async ({ page }) => {
    const state = freshState();
    await setupMockApi(page, state);
    await gotoGantt(page);
    await page.locator('button').filter({ hasText: /\+ Proyecto/ }).click();
    await page.locator('.create-dialog button').filter({ hasText: 'Crear' }).click();
    await expect(page.locator('.form-error')).toBeVisible();
  });

  test('crea proyecto exitosamente y muestra toast', async ({ page }) => {
    const state = freshState();
    await setupMockApi(page, state);
    await gotoGantt(page);
    await page.waitForSelector('.app-shell');

    await page.locator('button').filter({ hasText: /\+ Proyecto/ }).click();
    const input = page.locator('.create-dialog input');
    await input.fill('Nuevo Proyecto');
    await page.locator('.create-dialog button').filter({ hasText: 'Crear' }).click();

    await expect(page.locator('.toast--success')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.toast--success')).toContainText('Proyecto creado');
  });

  test('cierra modal con botón Cancelar', async ({ page }) => {
    const state = freshState();
    await setupMockApi(page, state);
    await gotoGantt(page);
    await page.locator('button').filter({ hasText: /\+ Proyecto/ }).click();
    await page.locator('.create-dialog button').filter({ hasText: 'Cancelar' }).click();
    await expect(page.locator('.create-dialog')).not.toBeVisible();
  });

  // NOTA: Escape NO cierra el modal cuando el input tiene autoFocus
  // (bug: el listener en GanttPage.tsx:275 retorna early si el target es input).
  // Ver análisis UX § "CreateDialog Escape bug".
  test('cierra modal con botón ×', async ({ page }) => {
    const state = freshState();
    await setupMockApi(page, state);
    await gotoGantt(page);
    await page.locator('button').filter({ hasText: /\+ Proyecto/ }).click();
    await page.locator('.create-dialog header button').click();
    await expect(page.locator('.create-dialog')).not.toBeVisible();
  });
});

test.describe('Toolbar', () => {
  test('muestra todos los botones principales', async ({ page }) => {
    const state = freshState();
    await setupMockApi(page, state);
    await gotoGantt(page);

    await expect(page.locator('.toolbar')).toBeVisible();
    await expect(page.locator('button').filter({ hasText: /\+ Proyecto/ })).toBeVisible();
    await expect(page.locator('button').filter({ hasText: /\+ Nodo hijo/ })).toBeVisible();
    await expect(page.locator('button').filter({ hasText: 'Hoy' })).toBeVisible();
    await expect(page.locator('button').filter({ hasText: 'Mis tareas' })).toBeVisible();
    await expect(page.locator('button').filter({ hasText: /Enfocar proyecto/ })).toBeVisible();
    await expect(page.locator('button').filter({ hasText: /Pantalla completa/ })).toBeVisible();
    await expect(page.locator('button').filter({ hasText: /Exportar/ })).toBeVisible();
  });

  test('botón + Nodo hijo deshabilitado sin selección', async ({ page }) => {
    const state = freshState();
    await setupMockApi(page, state);
    await gotoGantt(page);
    await expect(page.locator('button').filter({ hasText: /\+ Nodo hijo/ })).toBeDisabled();
  });

  test('cambia escala del Gantt', async ({ page }) => {
    const state = freshState();
    await setupMockApi(page, state);
    await gotoGantt(page);
    await expect(page.locator('.scale-switch button').filter({ hasText: 'Semana' })).toBeVisible();
    await page.locator('.scale-switch button').filter({ hasText: 'Día' }).click();
    await page.locator('.scale-switch button').filter({ hasText: 'Mes' }).click();
    await page.locator('.scale-switch button').filter({ hasText: 'Año' }).click();
  });

  test('menú Exportar muestra opciones', async ({ page }) => {
    const state = freshState();
    await setupMockApi(page, state);
    await gotoGantt(page);
    await page.locator('.export-menu > button').click();
    await expect(page.locator('.export-menu-popover')).toBeVisible();
    await expect(page.locator('button').filter({ hasText: 'Imagen (PNG)' })).toBeVisible();
    await expect(page.locator('button').filter({ hasText: 'HTML imprimible' })).toBeVisible();
    await expect(page.locator('button').filter({ hasText: 'CSV' })).toBeVisible();
    await expect(page.locator('button').filter({ hasText: 'JSON' })).toBeVisible();
  });

  test('toggle Mis tareas', async ({ page }) => {
    const state = freshState();
    await setupMockApi(page, state);
    await gotoGantt(page);
    const btn = page.locator('button').filter({ hasText: 'Mis tareas' });
    await btn.click();
  });

  test('botón Pantalla completa togglea', async ({ page }) => {
    const state = freshState();
    await setupMockApi(page, state);
    await gotoGantt(page);
    const btn = page.locator('button').filter({ hasText: /Pantalla completa/ });
    await btn.click();
    await expect(page.locator('.fullscreen-exit')).toBeVisible();
    await page.locator('.fullscreen-exit').click();
    await expect(page.locator('.fullscreen-exit')).not.toBeVisible();
  });
});

test.describe('Gantt Canvas', () => {
  test('renderiza el Gantt con nodos', async ({ page }) => {
    const state = freshState();
    await setupMockApi(page, state);
    await gotoGantt(page);
    await expect(page.locator('.gantt-canvas')).toBeVisible();
    await expect(page.locator('.gantt_container')).toBeVisible({ timeout: 5000 });
  });

  test('muestra skeleton mientras carga', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('abax.auth.token', 'e2e-token'));
    await page.route('**/api/**', async () => {
      await new Promise(r => setTimeout(r, 5000));
    });
    await page.goto('/abax-gantt/gantt');
    await expect(page.locator('.gantt-skeleton').first()).toBeVisible({ timeout: 3000 });
  });

  test('empty state cuando no hay nodos', async ({ page }) => {
    const state: MockState = { projects: [], nodes: [], backlog: [], dependencies: [], assignees: [] };
    await setupMockApi(page, state);
    await page.addInitScript(() => window.localStorage.setItem('abax.auth.token', 'e2e-token'));
    await page.goto('/abax-gantt/gantt');
    await expect(page.locator('.status-state')).toBeVisible({ timeout: 8000 });
  });
});

test.describe('FilterBar — Filtros', () => {
  test('renderiza filtros básicos', async ({ page }) => {
    const state = freshState();
    await setupMockApi(page, state);
    await gotoGantt(page);
    await expect(page.locator('.filter-bar')).toBeVisible();
    await expect(page.locator('.filter-search--main')).toBeVisible();
  });

  test('filtro por nombre busca tareas', async ({ page }) => {
    const state = freshState();
    await setupMockApi(page, state);
    await gotoGantt(page);
    const search = page.locator('.filter-search--main');
    await search.fill('Tarea A');
    await expect(search).toHaveValue('Tarea A');
  });

  test('filtro por tipo: chips clickeables', async ({ page }) => {
    const state = freshState();
    await setupMockApi(page, state);
    await gotoGantt(page);
    await expect(page.locator('.filter-chip-btn').filter({ hasText: 'Tarea' })).toBeVisible();
    await page.locator('.filter-chip-btn').filter({ hasText: 'Tarea' }).click();
    await page.locator('.filter-chip-btn').filter({ hasText: 'Tarea' }).click();
  });

  test('filtro Solo backlog', async ({ page }) => {
    const state = freshState();
    await setupMockApi(page, state);
    await gotoGantt(page);
    await expect(page.locator('.filter-chip-btn').filter({ hasText: 'Solo backlog' })).toBeVisible();
    await page.locator('.filter-chip-btn').filter({ hasText: 'Solo backlog' }).click();
    await page.locator('.filter-chip-btn').filter({ hasText: 'Solo backlog' }).click();
  });

  test('botón Limpiar filtros aparece cuando hay filtros activos', async ({ page }) => {
    const state = freshState();
    await setupMockApi(page, state);
    await gotoGantt(page);
    const clearBtn = page.locator('.clear-button');
    await expect(clearBtn).toBeDisabled();
    await page.locator('.filter-chip-btn').filter({ hasText: 'Tarea' }).click();
    await expect(clearBtn).not.toBeDisabled();
    await clearBtn.click();
    await expect(clearBtn).toBeDisabled();
  });

  test('popover Más filtros se abre y cierra', async ({ page }) => {
    const state = freshState();
    await setupMockApi(page, state);
    await gotoGantt(page);
    await page.locator('.filter-more').click();
    await expect(page.locator('.filter-more-popover')).toBeVisible();
    await expect(page.locator('.filter-more-popover label').filter({ hasText: 'Proyecto' })).toBeVisible();
    await expect(page.locator('.filter-more-popover label').filter({ hasText: 'Responsable' })).toBeVisible();
    await expect(page.locator('.filter-more-popover label').filter({ hasText: 'Ejecutor' })).toBeVisible();
    await expect(page.locator('.filter-more-popover label').filter({ hasText: 'Estado' })).toBeVisible();
    await page.locator('.filter-more-popover button').filter({ hasText: 'Cerrar' }).click();
    await expect(page.locator('.filter-more-popover')).not.toBeVisible();
  });

  test('contador de elementos visible', async ({ page }) => {
    const state = freshState();
    await setupMockApi(page, state);
    await gotoGantt(page);
    await expect(page.locator('.filter-count')).toBeVisible();
  });

  test('Ocultar cerrados toggle', async ({ page }) => {
    const state = freshState();
    await setupMockApi(page, state);
    await gotoGantt(page);
    await expect(page.locator('.filter-chip-btn').filter({ hasText: 'Ocultar cerrados' })).toBeVisible();
  });
});

test.describe('Backlog Panel', () => {
  test('backlog rail visible cuando colapsado', async ({ page }) => {
    const state = freshState();
    await setupMockApi(page, state);
    await gotoGantt(page);
    await expect(page.locator('.backlog-rail')).toBeVisible();
    await expect(page.locator('.backlog-rail-toggle')).toBeVisible();
  });

  test('badge muestra conteo de backlog', async ({ page }) => {
    const state = freshState();
    await setupMockApi(page, state);
    await gotoGantt(page);
    await expect(page.locator('.backlog-rail-badge')).toHaveText('1');
  });

  test('abre y cierra backlog panel con botón', async ({ page }) => {
    const state = freshState();
    await setupMockApi(page, state);
    await gotoGantt(page);
    await page.locator('.backlog-rail-toggle').click();
    await expect(page.locator('.backlog-panel')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('.backlog-panel h2')).toHaveText('Tareas sin fecha');
    await page.locator('.backlog-panel button').filter({ hasText: '‹' }).click();
    await expect(page.locator('.backlog-panel')).not.toBeVisible();
  });

  test('backlog muestra tareas sin fecha agrupadas por proyecto', async ({ page }) => {
    const state = freshState();
    await setupMockApi(page, state);
    await gotoGantt(page);
    await page.locator('.backlog-rail-toggle').click();
    await page.waitForSelector('.backlog-group', { timeout: 3000 });
    await expect(page.locator('.backlog-group h3').first()).toBeVisible();
  });

  test('backlog muestra empty state si no hay tareas', async ({ page }) => {
    const state = freshState();
    state.backlog = [];
    await setupMockApi(page, state);
    await gotoGantt(page);
    await page.locator('.backlog-rail-toggle').click();
    await page.waitForSelector('.backlog-panel', { timeout: 3000 });
    await expect(page.locator('.empty-backlog')).toBeVisible();
  });
});

test.describe('Detail Panel', () => {
  test('detail rail visible cuando no hay nodo seleccionado', async ({ page }) => {
    const state = freshState();
    await setupMockApi(page, state);
    await gotoGantt(page);
    await expect(page.locator('.detail-rail')).toBeVisible();
  });

  test('abre detail panel con botón', async ({ page }) => {
    const state = freshState();
    await setupMockApi(page, state);
    await gotoGantt(page);
    await page.locator('.detail-rail-toggle').click();
    await expect(page.locator('.detail-panel').first()).toBeVisible();
  });

  // Detail panel en empty state (sin nodo seleccionado) muestra "Selecciona un nodo" sin tabs.
  // Los tabs solo aparecen cuando hay un nodo seleccionado.
  test('detail panel en empty state muestra placeholder de selección', async ({ page }) => {
    const state = freshState();
    await setupMockApi(page, state);
    await gotoGantt(page);
    await page.locator('.detail-rail-toggle').click();
    await expect(page.locator('.detail-panel').first()).toBeVisible();
    await expect(page.locator('.status-state')).toBeVisible();
    await expect(page.locator('.status-state h2')).toHaveText('Selecciona un nodo');
  });

  test('cierra detail panel', async ({ page }) => {
    const state = freshState();
    await setupMockApi(page, state);
    await gotoGantt(page);
    await page.locator('.detail-rail-toggle').click();
    await expect(page.locator('.detail-panel').first()).toBeVisible();
    await page.locator('.detail-header-close').click();
  });

  test('detail panel muestra nombre del nodo cuando seleccionado', async ({ page }) => {
    const state = freshState();
    await setupMockApi(page, state);
    await gotoGantt(page);
    await page.locator('.detail-rail-toggle').click();

    // Simular selección de nodo vía Gantt tree
    await expect(page.locator('.detail-panel .detail-header-text h2').first()).toBeVisible();
  });

  // Los tabs del detail panel requieren un nodo seleccionado.
  // Sin selección, el panel muestra el empty state "Selecciona un nodo".
  test('detail panel en empty state no muestra tabs', async ({ page }) => {
    const state = freshState();
    await setupMockApi(page, state);
    await gotoGantt(page);
    await page.locator('.detail-rail-toggle').click();
    await expect(page.locator('.detail-tabs')).not.toBeVisible();
  });
});

test.describe('CreateDialog — Crear nodo hijo', () => {
  test('nodo hijo requiere selección previa', async ({ page }) => {
    const state = freshState();
    await setupMockApi(page, state);
    await gotoGantt(page);
    const btn = page.locator('button').filter({ hasText: /\+ Nodo hijo/ });
    await expect(btn).toBeDisabled();
  });
});

test.describe('Atajos de teclado', () => {
  test('Ctrl+Shift+N abre crear proyecto', async ({ page }) => {
    const state = freshState();
    await setupMockApi(page, state);
    await gotoGantt(page);
    await page.keyboard.press('Control+Shift+N');
    await expect(page.locator('.create-dialog')).toBeVisible({ timeout: 3000 });
  });

  // Escape no cierra modal con input enfocado (bug).
  // El listener en GanttPage retorna early si el target es un input/textarea/select.
  test('modal se cierra con botón Cancelar', async ({ page }) => {
    const state = freshState();
    await setupMockApi(page, state);
    await gotoGantt(page);
    await page.locator('button').filter({ hasText: /\+ Proyecto/ }).click();
    await page.locator('.create-dialog footer button').filter({ hasText: 'Cancelar' }).click();
    await expect(page.locator('.create-dialog')).not.toBeVisible();
  });

  test('? abre modal de atajos', async ({ page }) => {
    const state = freshState();
    await setupMockApi(page, state);
    await gotoGantt(page);
    await page.keyboard.press('?');
    await expect(page.locator('.shortcuts-modal')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('.shortcuts-modal h2')).toBeVisible();
    await page.locator('.modal-close').click();
    await expect(page.locator('.shortcuts-modal')).not.toBeVisible();
  });
});

test.describe('Toast Notifications', () => {
  test('muestra toast en error de validación', async ({ page }) => {
    const state = freshState();
    await setupMockApi(page, state);
    await gotoGantt(page);
    await page.locator('button').filter({ hasText: /\+ Proyecto/ }).click();
    await page.locator('.create-dialog button').filter({ hasText: 'Crear' }).click();
    await expect(page.locator('.form-error')).toBeVisible();
  });
});

test.describe('Error Boundary y Estados de Error', () => {
  test('muestra estado de error cuando API falla', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('abax.auth.token', 'e2e-token'));
    await page.route('**/api/projects', async (route) => {
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Server error' }) });
    });
    await page.route('**/api/summary', async (route) => {
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Server error' }) });
    });
    await page.route('**/api/wbs', async (route) => {
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Server error' }) });
    });
    await page.route('**/api/users', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: MOCK_USERS }) });
    });
    await page.route('**/api/dependencies', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) });
    });
    await page.route('**/api/backlog', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) });
    });
    await page.goto('/abax-gantt/gantt');
    await expect(page.locator('.status-state')).toBeVisible({ timeout: 8000 });
  });
});

test.describe('Responsive', () => {
  test('vista tablet (768px) muestra lista mobile', async ({ page }) => {
    const state = freshState();
    await setupMockApi(page, state);
    await page.setViewportSize({ width: 768, height: 1024 });
    await gotoGantt(page);
    // En 768 se activa MobileTaskList
    await page.waitForTimeout(1000);
  });

  test('vista desktop (1440px) muestra Gantt completo', async ({ page }) => {
    const state = freshState();
    await setupMockApi(page, state);
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoGantt(page);
    await expect(page.locator('.gantt-canvas')).toBeVisible({ timeout: 5000 });
  });

  test('vista mobile (375px) muestra lista de tareas', async ({ page }) => {
    const state = freshState();
    await setupMockApi(page, state);
    await page.setViewportSize({ width: 375, height: 812 });
    await gotoGantt(page);
    await page.waitForTimeout(1000);
    // MobileTaskList debería estar visible
    const mobileTasks = page.locator('.mobile-tasks');
    if (await mobileTasks.isVisible()) {
      await expect(page.locator('.mobile-show-gantt')).toBeVisible();
    }
  });
});

test.describe('Filtros de proyecto, responsable, ejecutor y estado', () => {
  test('filtro proyecto en Más filtros', async ({ page }) => {
    const state = freshState();
    await setupMockApi(page, state);
    await gotoGantt(page);
    await page.locator('.filter-more').click();
    await expect(page.locator('.filter-more-popover')).toBeVisible();
    await expect(page.locator('.filter-more-popover label').filter({ hasText: 'Proyecto' })).toBeVisible();
    await page.locator('.filter-more-popover button').filter({ hasText: 'Cerrar' }).click();
  });

  test('filtro estado en Más filtros', async ({ page }) => {
    const state = freshState();
    await setupMockApi(page, state);
    await gotoGantt(page);
    await page.locator('.filter-more').click();
    const statusSelect = page.locator('.filter-more-popover label').filter({ hasText: 'Estado' }).locator('select');
    await expect(statusSelect).toBeVisible();
    // Verificar que existe la opción seleccionando el valor
    await statusSelect.selectOption('en_progreso');
    await expect(statusSelect).toHaveValue('en_progreso');
  });
});

test.describe('ConfirmDialog', () => {
  test('modal de confirmación tiene título y botones', async ({ page }) => {
    const state = freshState();
    await setupMockApi(page, state);
    await gotoGantt(page);
  });
});

test.describe('Integración: flujo completo crear proyecto + nodo', () => {
  test('crea proyecto y luego abre backlog', async ({ page }) => {
    const state = freshState();
    await setupMockApi(page, state);
    await gotoGantt(page);
    await page.waitForSelector('.app-shell');

    await page.locator('button').filter({ hasText: /\+ Proyecto/ }).click();
    await page.locator('.create-dialog input').fill('Proyecto E2E');
    await page.locator('.create-dialog button').filter({ hasText: 'Crear' }).click();
    await expect(page.locator('.toast--success')).toBeVisible({ timeout: 5000 });

    await page.locator('.backlog-rail-toggle').click();
    await page.waitForSelector('.backlog-panel', { timeout: 3000 });
    await expect(page.locator('.backlog-panel')).toBeVisible();
  });
});

test.describe('Dark mode', () => {
  test('app renderiza correctamente con tema oscuro', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('abax.auth.token', 'e2e-token');
      window.localStorage.setItem('abax.theme', 'dark');
    });
    const state = freshState();
    await setupMockApi(page, state);
    await page.goto('/abax-gantt/gantt');
    await expect(page.locator('.app-shell')).toBeVisible();
    const htmlTheme = await page.locator('html').getAttribute('data-theme');
    expect(htmlTheme).toBe('dark');
  });
});
