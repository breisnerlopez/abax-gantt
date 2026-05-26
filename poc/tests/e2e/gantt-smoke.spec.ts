import { expect, test, type Page, type Route } from '@playwright/test';

const users = [
  { id: 'user-resp', email: 'responsable.demo@abax.local', full_name: 'Responsable Demo', avatar_url: null, status: 'active' },
  { id: 'user-exec', email: 'ejecutor.demo@abax.local', full_name: 'Ejecutor Demo', avatar_url: null, status: 'active' },
];

const project = { id: 'project-demo', name: 'Demo E2E', description: null, status: 'active', budget_total: 250000 };
const NOW = new Date().toISOString().slice(0, 10);

test('handles toast notifications for validation errors on empty name', async ({ page }) => {
  await mockApi(page);
  await page.addInitScript(() => window.localStorage.setItem('abax.auth.token', 'e2e-token'));
  await page.goto('/abax-gantt/gantt');
  await page.getByRole('button', { name: /\+ Proyecto/ }).click();
  await page.getByRole('button', { name: 'Crear' }).click();
  await expect(page.getByText('El nombre es obligatorio.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Cancelar' }).click();
});

test('keeps single-day tasks at duration=1', async ({ page }) => {
  await mockApi(page);
  await page.addInitScript(() => window.localStorage.setItem('abax.auth.token', 'e2e-token'));
  await page.goto('/abax-gantt/gantt');
  await page.waitForSelector('.gantt_container', { timeout: 10000 });

  const duration = await page.evaluate(() => {
    type GanttTask = { duration?: number };
    type GanttApi = { getTask: (id: string) => GanttTask };
    type Win = { gantt?: GanttApi; dhtmlx?: { gantt?: GanttApi } };
    const w = window as unknown as Win;
    const g = w.gantt ?? w.dhtmlx?.gantt;
    if (!g?.getTask) return null;
    const task = g.getTask('n-task1');
    return task?.duration ?? null;
  });
  expect(duration).toBe(1);
});

async function mockApi(page: Page) {
  const state = {
    projects: [project] as Array<typeof project>,
    nodes: [
      {
        id: 'n-root',
        project_id: project.id,
        parent_id: null,
        name: project.name,
        type: 'project',
        description: null,
        start_date: NOW,
        end_date: NOW,
        duration_days: 1,
        progress: 0,
        estimated_hours: null,
        estimated_cost: null,
        color: null,
        sort_order: 0,
        responsible_id: 'user-resp',
        is_unscheduled: false,
        status: null,
        path: 'n_root',
      },
      {
        id: 'n-task1',
        project_id: project.id,
        parent_id: 'n-root',
        name: 'Tarea A',
        type: 'task',
        description: null,
        start_date: NOW,
        end_date: NOW,
        duration_days: null,
        progress: 0,
        estimated_hours: null,
        estimated_cost: null,
        color: null,
        sort_order: 0,
        responsible_id: 'user-exec',
        is_unscheduled: false,
        status: null,
        path: 'n_root.n_task1',
      },
    ] as WbsNode[],
    backlog: [] as WbsNode[],
    dependencies: [] as unknown[],
    assignees: [] as unknown[],
    attachments: [] as unknown[],
  };

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^.*\/api\//, 'api/');
    const method = route.request().method();

    if (path === 'api/projects' && method === 'GET') return json(route, state.projects);
    if (path === 'api/users' && method === 'GET') return json(route, users);
    if (path === 'api/wbs' && method === 'GET') return json(route, state.nodes);
    if (path === 'api/backlog' && method === 'GET') return json(route, state.backlog);
    if (path === 'api/dependencies' && method === 'GET') return json(route, state.dependencies);
    if (path === 'api/summary' && method === 'GET') return json(route, null);

    if (path == 'api/assignees' && method === 'GET') return json(route, state.assignees);

    if (path === `api/reports/${project.id}` && method === 'GET') {
      return json(route, { project, budget: { total: 0, estimated_cost: 0, consumed_pct: 0 }, hours: { estimated: 0, actual: 0, variance_pct: 0 }, progress: 0, task_count: 0, task_breakdown: [], hours_by_person: [] });
    }

    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [], count: 0 }) });
  });

  return state;
}

async function json(route: Route, data: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify({ data, count: Array.isArray(data) ? data.length : undefined }),
  });
}
