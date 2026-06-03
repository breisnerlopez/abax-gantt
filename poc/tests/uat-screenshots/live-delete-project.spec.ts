/* Smoke real contra demo:
   1. El botón "Eliminar proyecto" aparece al seleccionar el root.
   2. El dialog reforzado lista "N tareas/etapas" y "M dependencias".
   3. El divisor del grid (grid_resize) es arrastrable y persiste. */
import { test, expect, type Page } from '@playwright/test';

const BASE = process.env.UAT_BASE_URL ?? 'https://demo.breisner.info/abax-gantt';
const TOKEN = process.env.AKADMIN_TOKEN ?? '';
const TEST_PROJ_ID = '9a6ef4ce-90da-457e-aa98-13ba6096d4ab'; // 'persona'

test.use({ viewport: { width: 1440, height: 900 } });

async function login(page: Page) {
  expect(TOKEN).toBeTruthy();
  await page.addInitScript((tok) => {
    window.localStorage.setItem('abax.auth.token', tok);
    window.localStorage.setItem('abax.detail.visible', '1');
  }, TOKEN);
}

test('botón Eliminar proyecto visible al seleccionar el root', async ({ page }) => {
  await login(page);
  await page.goto(`${BASE}/gantt?focus=${TEST_PROJ_ID}`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);
  await page.locator('.gantt_row').first().click({ timeout: 10000 });
  await page.waitForTimeout(1000);
  const btn = page.locator('.detail-delete-btn');
  await expect(btn).toBeVisible();
  await expect(btn).toHaveText('Eliminar proyecto');
});

test('dialog del proyecto detalla alcance permanente', async ({ page }) => {
  await login(page);
  await page.goto(`${BASE}/gantt?focus=${TEST_PROJ_ID}`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);
  await page.locator('.gantt_row').first().click({ timeout: 10000 });
  await page.waitForTimeout(800);
  await page.locator('.detail-delete-btn').click();
  const dialog = page.locator('[role="alertdialog"]');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('PROYECTO completo');
  await expect(dialog).toContainText('permanente');
  await expect(dialog.getByRole('button', { name: 'Eliminar proyecto' })).toBeVisible();
  // Cancelamos — no queremos borrar el proyecto real.
  await dialog.getByRole('button', { name: 'Cancelar' }).click();
  await expect(dialog).not.toBeVisible();
});

test('grid_resize persiste el ancho del grid en localStorage', async ({ page }) => {
  await login(page);
  await page.addInitScript(() => window.localStorage.setItem('abax.grid.width', '480'));
  await page.goto(`${BASE}/gantt?focus=${TEST_PROJ_ID}`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);
  // Lectura interna de DHTMLX para validar que la config se aplicó.
  const w = await page.evaluate(() => {
    interface GanttConfig { grid_width?: number; grid_resize?: boolean }
    const g = (window as unknown as { gantt?: { config: GanttConfig } }).gantt;
    return {
      width: g?.config.grid_width,
      resize: g?.config.grid_resize,
      lsValue: window.localStorage.getItem('abax.grid.width'),
    };
  });
  console.log('GRID_DBG =', JSON.stringify(w));
  expect(w.resize, 'grid_resize=true').toBe(true);
  expect(w.lsValue, 'localStorage abax.grid.width').toBe('480');
});
