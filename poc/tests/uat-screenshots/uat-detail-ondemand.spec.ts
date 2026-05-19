import { test, Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.UAT_BASE_URL ?? 'https://demo.breisner.info/abax-gantt';
const ADMIN_TOKEN = process.env.AKADMIN_TOKEN ?? '';
const OUT = process.env.SCREENSHOT_DIR ?? join(process.cwd(), '..', 'docs', 'screenshots');
mkdirSync(OUT, { recursive: true });

async function inject(page: Page) {
  await page.goto(`${BASE}/login`);
  await page.evaluate((t) => window.localStorage.setItem('abax.auth.token', t), ADMIN_TOKEN);
}

test.describe('DetailPanel on-demand', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('70 sin panel default', async ({ page }) => {
    await inject(page);
    await page.addInitScript(() => localStorage.removeItem('abax.detail.visible'));
    await page.goto(`${BASE}/gantt`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2500);
    await page.screenshot({ path: join(OUT, '70-no-panel.png'), fullPage: false });
  });

  test('71 panel abierto desde topbar', async ({ page }) => {
    await inject(page);
    await page.goto(`${BASE}/gantt`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2500);
    // Seleccionar primero un nodo
    const firstRow = page.locator('.gantt_tree_content').first();
    if (await firstRow.count() > 0) {
      await firstRow.click();
      await page.waitForTimeout(400);
    }
    // Abrir el panel con el toggle (botón ◨ en topbar)
    const toggle = page.getByRole('button', { name: /Mostrar panel/i });
    if (await toggle.count() > 0) {
      await toggle.click();
      await page.waitForTimeout(500);
    }
    await page.screenshot({ path: join(OUT, '71-panel-abierto.png'), fullPage: false });
  });

  test('72 panel cerrado con botón ✕', async ({ page }) => {
    await inject(page);
    await page.addInitScript(() => localStorage.setItem('abax.detail.visible', '1'));
    await page.goto(`${BASE}/gantt`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2500);
    const firstRow = page.locator('.gantt_tree_content').first();
    if (await firstRow.count() > 0) {
      await firstRow.click();
      await page.waitForTimeout(400);
    }
    const close = page.locator('.detail-close-btn').first();
    if (await close.count() > 0) {
      await close.click();
      await page.waitForTimeout(400);
    }
    await page.screenshot({ path: join(OUT, '72-panel-cerrado-con-x.png'), fullPage: false });
  });
});
