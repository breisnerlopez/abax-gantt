/* Smoke local del feature "borrar nodo" — botón en footer del DetailPanel
   y atajo Cmd/Ctrl+Shift+Backspace, ambos abren ConfirmDialog. */
import { expect, test, type Page, type Route } from '@playwright/test';

const NOW = new Date().toISOString().slice(0, 10);

const users = [
  { id: 'u-resp', email: 'resp@a.local', full_name: 'Responsable', avatar_url: null, status: 'active', is_admin: true },
];
const project = { id: 'p-1', name: 'Demo Delete', description: null, status: 'active', budget_total: 1000 };
const nodes = [
  { id: 'n-root', project_id: 'p-1', parent_id: null, name: 'Demo Delete', type: 'project', description: null, start_date: NOW, end_date: NOW, duration_days: 1, progress: 0, estimated_hours: null, estimated_cost: null, color: null, sort_order: 0, responsible_id: 'u-resp', is_unscheduled: false, status: null, path: 'n_root' },
  { id: 'n-task', project_id: 'p-1', parent_id: 'n-root', name: 'Tarea A borrable', type: 'task', description: null, start_date: NOW, end_date: NOW, duration_days: 1, progress: 0, estimated_hours: null, estimated_cost: null, color: null, sort_order: 0, responsible_id: 'u-resp', is_unscheduled: false, status: null, path: 'n_root.n_task' },
];

async function mockApi(page: Page, deleted: { value: boolean }) {
  await page.route('**/api/**', async (route: Route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^.*\/api\//, 'api/').split('?')[0];
    const method = route.request().method();
    const json = (data: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ data, count: Array.isArray(data) ? data.length : undefined }) });

    if (method === 'DELETE' && path === 'api/wbs/n-task') {
      deleted.value = true;
      return route.fulfill({ status: 204, body: '' });
    }
    if (path === 'api/projects') return json([project]);
    if (path === 'api/users') return json(users);
    if (path === 'api/wbs') return json(deleted.value ? nodes.filter((n) => n.id !== 'n-task') : nodes);
    if (path === 'api/backlog') return json([]);
    if (path === 'api/dependencies') return json([]);
    if (path === 'api/summary') return json(null);
    if (path === 'api/teams') return json([]);
    if (path.startsWith('api/assignees')) return json([]);
    return json([]);
  });
}

async function gotoGanttAndSelectTask(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('abax.auth.token', 'e2e');
    window.localStorage.setItem('abax.detail.visible', '1');
  });
  await page.goto('/abax-gantt/gantt');
  await page.waitForSelector('.gantt_container', { timeout: 10000 });
  // Click la fila de la tarea para seleccionarla
  await page.locator('.gantt_row').filter({ hasText: 'Tarea A borrable' }).first().click();
  await page.waitForSelector('.detail-panel h2');
}

test.describe('Borrar nodo', () => {
  test('botón Eliminar dispara ConfirmDialog, confirmar borra', async ({ page }) => {
    const deleted = { value: false };
    await mockApi(page, deleted);
    await gotoGanttAndSelectTask(page);

    await expect(page.locator('.detail-delete-btn')).toBeVisible();
    await page.locator('.detail-delete-btn').click();

    const dialog = page.locator('[role="alertdialog"]');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Eliminar');
    await expect(dialog).toContainText('Tarea A borrable');
    await dialog.getByRole('button', { name: 'Eliminar' }).click();

    // El backend recibió el DELETE y el dialog se cierra cuando la mutación termina.
    await expect.poll(() => deleted.value, { timeout: 5000 }).toBe(true);
    await expect(dialog).not.toBeVisible({ timeout: 5000 });
  });

  test('atajo Cmd+Shift+Backspace abre el dialog', async ({ page }) => {
    const deleted = { value: false };
    await mockApi(page, deleted);
    await gotoGanttAndSelectTask(page);
    await page.keyboard.press('Meta+Shift+Backspace');
    await expect(page.locator('[role="alertdialog"]')).toBeVisible({ timeout: 3000 });
    // Cancelar — no borra
    await page.locator('[role="alertdialog"]').getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.locator('[role="alertdialog"]')).not.toBeVisible();
    expect(deleted.value).toBe(false);
  });

  test('botón Eliminar también aparece para proyectos (root)', async ({ page }) => {
    const deleted = { value: false };
    await mockApi(page, deleted);
    await page.addInitScript(() => {
      window.localStorage.setItem('abax.auth.token', 'e2e');
      window.localStorage.setItem('abax.detail.visible', '1');
    });
    await page.goto('/abax-gantt/gantt');
    await page.waitForSelector('.gantt_container', { timeout: 10000 });
    await page.locator('.gantt_row').filter({ hasText: 'Demo Delete' }).first().click();
    await page.waitForTimeout(400);
    // Antes el botón se ocultaba para projects; ahora se muestra con label
    // distinto ("Eliminar proyecto") y dispara un dialog reforzado.
    await expect(page.locator('.detail-delete-btn')).toBeVisible();
    await expect(page.locator('.detail-delete-btn')).toHaveText('Eliminar proyecto');
  });
});
