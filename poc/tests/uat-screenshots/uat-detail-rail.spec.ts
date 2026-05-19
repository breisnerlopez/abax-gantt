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

test.describe('Detail rail colapsado', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('80 rail sin selección', async ({ page }) => {
    await inject(page);
    await page.addInitScript(() => localStorage.removeItem('abax.detail.visible'));
    await page.goto(`${BASE}/gantt`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2500);
    await page.screenshot({ path: join(OUT, '80-rail-sin-seleccion.png'), fullPage: false });
  });

  test('81 rail con selección', async ({ page }) => {
    await inject(page);
    await page.goto(`${BASE}/gantt`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2500);
    const firstRow = page.locator('.gantt_tree_content').first();
    if (await firstRow.count() > 0) {
      await firstRow.click();
      await page.waitForTimeout(500);
    }
    await page.screenshot({ path: join(OUT, '81-rail-con-seleccion.png'), fullPage: false });
  });

  test('82 panel abierto desde rail', async ({ page }) => {
    await inject(page);
    await page.goto(`${BASE}/gantt`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2500);
    const firstRow = page.locator('.gantt_tree_content').first();
    if (await firstRow.count() > 0) {
      await firstRow.click();
      await page.waitForTimeout(500);
    }
    const railBtn = page.locator('.detail-rail-toggle').first();
    if (await railBtn.count() > 0) {
      await railBtn.click();
      await page.waitForTimeout(500);
    }
    await page.screenshot({ path: join(OUT, '82-panel-abierto-rail.png'), fullPage: false });
  });
});
