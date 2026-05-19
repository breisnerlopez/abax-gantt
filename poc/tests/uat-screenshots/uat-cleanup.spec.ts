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

test.describe('Simplificación UI v4', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('40 vista limpia inicial', async ({ page }) => {
    await inject(page);
    await page.goto(`${BASE}/gantt`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: join(OUT, '40-vista-limpia.png'), fullPage: false });
  });

  test('41 KPI expandido', async ({ page }) => {
    await inject(page);
    await page.addInitScript(() => localStorage.setItem('abax.kpi.expanded', '1'));
    await page.goto(`${BASE}/gantt`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: join(OUT, '41-kpi-expandido.png'), fullPage: false });
  });

  test('42 Más filtros abierto', async ({ page }) => {
    await inject(page);
    await page.goto(`${BASE}/gantt`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2500);
    const moreBtn = page.locator('.filter-more').first();
    if (await moreBtn.count() > 0) {
      await moreBtn.click();
      await page.waitForTimeout(400);
    }
    await page.screenshot({ path: join(OUT, '42-mas-filtros.png'), fullPage: false });
  });

  test('43 admin con status pills', async ({ page }) => {
    await inject(page);
    await page.goto(`${BASE}/admin`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: join(OUT, '43-admin-status-pills.png'), fullPage: false });
  });

  test('44 export menu abierto', async ({ page }) => {
    await inject(page);
    await page.goto(`${BASE}/gantt`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2500);
    const btn = page.getByRole('button', { name: /Exportar/i }).first();
    if (await btn.count() > 0) {
      await btn.click();
      await page.waitForTimeout(300);
    }
    await page.screenshot({ path: join(OUT, '44-export-menu.png'), fullPage: false });
  });
});
