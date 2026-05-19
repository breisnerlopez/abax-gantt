import { test, Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.UAT_BASE_URL ?? 'https://demo.breisner.info/abax-gantt';
const ADMIN_TOKEN = process.env.AKADMIN_TOKEN ?? '';
const OUT = process.env.SCREENSHOT_DIR ?? join(process.cwd(), '..', 'docs', 'screenshots');

mkdirSync(OUT, { recursive: true });

async function injectToken(page: Page, token: string) {
  await page.goto(`${BASE}/login`);
  await page.evaluate((tok) => window.localStorage.setItem('abax.auth.token', tok), token);
}

async function shot(page: Page, name: string) {
  await page.screenshot({ path: join(OUT, `${name}.png`), fullPage: false });
}

test.describe('UAT v3 — verificación de los 6 fixes diferidos', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('22 modal de atajos abierto con ?', async ({ page }) => {
    await injectToken(page, ADMIN_TOKEN);
    await page.goto(`${BASE}/gantt`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2500);
    await page.keyboard.press('?');
    await page.waitForTimeout(400);
    await shot(page, '22-shortcuts-modal');
  });

  test('23 tooltip con ruta de ancestros (V-15)', async ({ page }) => {
    await injectToken(page, ADMIN_TOKEN);
    await page.goto(`${BASE}/gantt`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2500);
    // Hover sobre la primera barra del timeline
    const taskBar = page.locator('.gantt_task_line').first();
    if (await taskBar.count() > 0) {
      await taskBar.hover();
      await page.waitForTimeout(800);
    }
    await shot(page, '23-tooltip-ancestor-path');
  });

  test('24 skeleton durante carga (V-19)', async ({ page }) => {
    await injectToken(page, ADMIN_TOKEN);
    // Simular carga lenta
    await page.route('**/api/wbs**', async (route) => {
      await new Promise((r) => setTimeout(r, 2000));
      await route.continue();
    });
    await page.route('**/api/projects**', async (route) => {
      await new Promise((r) => setTimeout(r, 2000));
      await route.continue();
    });
    await page.goto(`${BASE}/gantt`);
    // Capturar mientras está cargando
    await page.waitForTimeout(600);
    await shot(page, '24-skeleton-loading');
  });

  test('25 filterbar al top (V-10)', async ({ page }) => {
    await injectToken(page, ADMIN_TOKEN);
    await page.goto(`${BASE}/gantt`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2500);
    await shot(page, '25-filterbar-top');
  });

  test('26 backlog rail nuevo (V-20)', async ({ page }) => {
    await injectToken(page, ADMIN_TOKEN);
    await page.goto(`${BASE}/gantt`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2500);
    // Zoom in al rail
    const rail = page.locator('.backlog-rail').first();
    if (await rail.count() > 0) {
      await rail.scrollIntoViewIfNeeded();
    }
    await shot(page, '26-backlog-rail-new');
  });
});
