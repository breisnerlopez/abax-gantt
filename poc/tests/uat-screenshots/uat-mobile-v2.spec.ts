import { test, Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.UAT_BASE_URL ?? 'https://demo.breisner.info/abax-gantt';
const ADMIN_TOKEN = process.env.AKADMIN_TOKEN ?? '';
const RESP_TOKEN = process.env.RESPONSABLE_TOKEN ?? '';
const EXEC_TOKEN = process.env.EJECUTOR_TOKEN ?? '';
const OUT = process.env.SCREENSHOT_DIR ?? join(process.cwd(), '..', 'docs', 'screenshots');
mkdirSync(OUT, { recursive: true });

async function inject(page: Page, token: string) {
  await page.goto(`${BASE}/login`);
  await page.evaluate((t) => window.localStorage.setItem('abax.auth.token', t), token);
}

test.describe('Mobile list view', () => {
  test('50 mobile lista admin', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await inject(page, ADMIN_TOKEN);
    await page.goto(`${BASE}/gantt`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2500);
    await page.screenshot({ path: join(OUT, '50-mobile-list-admin.png'), fullPage: true });
  });

  test('51 mobile lista responsable', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await inject(page, RESP_TOKEN);
    await page.goto(`${BASE}/gantt`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2500);
    await page.screenshot({ path: join(OUT, '51-mobile-list-responsable.png'), fullPage: true });
  });

  test('52 mobile lista ejecutor', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await inject(page, EXEC_TOKEN);
    await page.goto(`${BASE}/gantt`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2500);
    await page.screenshot({ path: join(OUT, '52-mobile-list-ejecutor.png'), fullPage: true });
  });

  test('53 mobile lista + slider activo', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await inject(page, ADMIN_TOKEN);
    await page.goto(`${BASE}/gantt`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2500);
    // Click "+ horas" en la primera tarea para mostrar input
    const hoursBtn = page.locator('.mtask-hours-btn').first();
    if (await hoursBtn.count() > 0) {
      await hoursBtn.click();
      await page.waitForTimeout(300);
    }
    await page.screenshot({ path: join(OUT, '53-mobile-hours-input.png'), fullPage: false });
  });

  test('54 toggle a Gantt en mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await inject(page, ADMIN_TOKEN);
    await page.goto(`${BASE}/gantt`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2500);
    const showGanttBtn = page.locator('.mobile-show-gantt').first();
    if (await showGanttBtn.count() > 0) {
      await showGanttBtn.click();
      await page.waitForTimeout(1500);
    }
    await page.screenshot({ path: join(OUT, '54-mobile-gantt-forzado.png'), fullPage: false });
  });
});
