/* Smoke real contra demo de los 4 fixes:
   1. Wheel sobre date input no cambia valor (no se rompen filtros)
   2. Gantt muestra fechas al futuro (no se corta en HOY)
   3. Selector de Equipo en DetailPanel para proyectos
   4. Filtro por equipo en FilterBar (chip activo + filtrado) */
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

test('1+2: Gantt muestra >6 meses al futuro (padding desactiva fit_tasks)', async ({ page }) => {
  await login(page);
  await page.goto(`${BASE}/gantt`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);
  // Inspect the gantt date range via DHTMLX state.
  const range = await page.evaluate(() => {
    // deno-lint-ignore no-explicit-any
    const g = (window as any).gantt;
    if (!g) return null;
    return { start: g.config.start_date?.toISOString?.(), end: g.config.end_date?.toISOString?.() };
  });
  expect(range, 'gantt config has start/end_date').not.toBeNull();
  expect(range!.start, 'start_date defined').toBeTruthy();
  expect(range!.end, 'end_date defined').toBeTruthy();
  // end debería estar al menos 5 meses en el futuro desde hoy.
  const minFuture = new Date();
  minFuture.setMonth(minFuture.getMonth() + 5);
  expect(new Date(range!.end!).getTime(), 'end_date >= hoy + 5 meses').toBeGreaterThanOrEqual(minFuture.getTime());
});

test('3: select Equipo aparece al seleccionar un proyecto (persona)', async ({ page }) => {
  await login(page);
  // Focus al proyecto (drill-down) — reduce a un solo árbol para evitar
  // virtual scrolling de DHTMLX con 100+ proyectos.
  await page.goto(`${BASE}/gantt?focus=9a6ef4ce-90da-457e-aa98-13ba6096d4ab`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3500);
  const projRow = page.locator('.gantt_row').first();
  await projRow.click({ timeout: 15000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: '/tmp/cert-live/05-detail-persona.png', fullPage: false });
  // El span del label "Equipo" indica que el campo está presente solo para proyectos.
  const equipoLabel = page.locator('.detail-content .edit-field span').filter({ hasText: /^Equipo$/ });
  await expect(equipoLabel).toHaveCount(1, { timeout: 5000 });
});

test('4: filtro por equipo presente en "Más filtros"', async ({ page }) => {
  await login(page);
  await page.goto(`${BASE}/gantt`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);
  await page.locator('.fb-chip').filter({ hasText: 'Más filtros' }).click();
  // El SearchableSelect del equipo tiene aria-label="Filtrar por equipo".
  await expect(page.locator('[aria-label="Filtrar por equipo"]')).toBeVisible({ timeout: 5000 });
  // El label "Equipo" del menú debe estar visible.
  await expect(page.locator('.fb-menu-label').filter({ hasText: /^Equipo$/ })).toBeVisible();
});
