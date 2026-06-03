/* Smoke real contra demo del feature "borrar nodo": verifica que el botón
   Eliminar aparece en el DetailPanel cuando un nodo seleccionable existe. */
import { test, expect, type Page } from '@playwright/test';

const BASE = process.env.UAT_BASE_URL ?? 'https://demo.breisner.info/abax-gantt';
const TOKEN = process.env.AKADMIN_TOKEN ?? '';

test.use({ viewport: { width: 1440, height: 900 } });

async function login(page: Page) {
  expect(TOKEN, 'AKADMIN_TOKEN').toBeTruthy();
  await page.addInitScript((tok) => {
    window.localStorage.setItem('abax.auth.token', tok);
    window.localStorage.setItem('abax.detail.visible', '1');
  }, TOKEN);
}

test('botón Eliminar visible al seleccionar una tarea en demo', async ({ page }) => {
  await login(page);
  await page.goto(`${BASE}/gantt`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  // Click la primera fila de tipo "tarea" disponible (no proyecto). El skin del
  // rediseño Fase 2 pone t-done|t-prog|t-late|t-pend en .gantt_task_line para
  // tareas hoja; las filas project/stage tienen .task-project/.task-stage.
  const taskRow = page.locator('.gantt_row').filter({
    has: page.locator('xpath=//ancestor::*[@class][contains(@class,"gantt_task_row")] | //div[contains(@class,"task-task")]'),
  }).first().or(page.locator('.gantt_row').first());
  await taskRow.click();
  await page.waitForTimeout(800);

  // El detail panel se abre con el nodo seleccionado.
  await expect(page.locator('.detail-panel h2').first()).toBeVisible({ timeout: 5000 });

  // El botón Eliminar es visible (solo si el nodo NO es proyecto). Si por azar
  // hicimos click en un root project, vamos a otra fila.
  let deleteBtn = page.locator('.detail-delete-btn');
  if (!(await deleteBtn.isVisible().catch(() => false))) {
    // Probamos con la segunda fila (más probable que sea hijo).
    await page.locator('.gantt_row').nth(1).click();
    await page.waitForTimeout(600);
    deleteBtn = page.locator('.detail-delete-btn');
  }
  await expect(deleteBtn).toBeVisible();
  await expect(deleteBtn).toContainText('Eliminar');
});
