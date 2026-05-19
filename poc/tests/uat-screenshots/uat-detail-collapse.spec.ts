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

test.describe('DetailPanel colapsable', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('60 detail expandido con nodo seleccionado', async ({ page }) => {
    await inject(page);
    await page.addInitScript(() => localStorage.removeItem('abax.detail.collapsed'));
    await page.goto(`${BASE}/gantt`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2500);
    // Click en una fila para seleccionar
    const firstRow = page.locator('.gantt_tree_content').first();
    if (await firstRow.count() > 0) {
      await firstRow.click();
      await page.waitForTimeout(600);
    }
    await page.screenshot({ path: join(OUT, '60-detail-expanded.png'), fullPage: false });
  });

  test('61 detail colapsado tras click en botón', async ({ page }) => {
    await inject(page);
    await page.goto(`${BASE}/gantt`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2500);
    const firstRow = page.locator('.gantt_tree_content').first();
    if (await firstRow.count() > 0) {
      await firstRow.click();
      await page.waitForTimeout(600);
    }
    const collapseBtn = page.locator('.detail-collapse-btn').first();
    if (await collapseBtn.count() > 0) {
      await collapseBtn.click();
      await page.waitForTimeout(500);
    }
    await page.screenshot({ path: join(OUT, '61-detail-collapsed.png'), fullPage: false });
  });

  test('62 detail colapsado persistente entre recargas', async ({ page }) => {
    await inject(page);
    await page.addInitScript(() => localStorage.setItem('abax.detail.collapsed', '1'));
    await page.goto(`${BASE}/gantt`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2500);
    const firstRow = page.locator('.gantt_tree_content').first();
    if (await firstRow.count() > 0) {
      await firstRow.click();
      await page.waitForTimeout(600);
    }
    await page.screenshot({ path: join(OUT, '62-detail-collapsed-persist.png'), fullPage: false });
  });
});
