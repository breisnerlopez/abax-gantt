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

test.describe('UAT extra — diagnóstico bugs visuales', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('15 admin antes-de-seleccionar (vista limpia)', async ({ page }) => {
    await injectToken(page, ADMIN_TOKEN);
    await page.goto(`${BASE}/gantt`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    await shot(page, '15-admin-pre-seleccion');
  });

  test('16 admin click en barra de tarea timeline', async ({ page }) => {
    await injectToken(page, ADMIN_TOKEN);
    await page.goto(`${BASE}/gantt`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    // Click on a task bar in timeline (DHTMLX renders these as .gantt_task_line)
    const taskBar = page.locator('.gantt_task_line').first();
    if (await taskBar.count() > 0) {
      await taskBar.click();
      await page.waitForTimeout(800);
    }
    await shot(page, '16-admin-click-task-bar');
  });

  test('17 admin click en nombre de tarea (lado izquierdo)', async ({ page }) => {
    await injectToken(page, ADMIN_TOKEN);
    await page.goto(`${BASE}/gantt`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    // Click on a task row in the grid (left side)
    const taskRow = page.locator('.gantt_tree_content').first();
    if (await taskRow.count() > 0) {
      await taskRow.click();
      await page.waitForTimeout(800);
    }
    await shot(page, '17-admin-click-task-name');
  });

  test('18 admin filterbar interaccion - filtro por tipo', async ({ page }) => {
    await injectToken(page, ADMIN_TOKEN);
    await page.goto(`${BASE}/gantt`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2500);
    // Click filter chip "task"
    const taskChip = page.getByRole('button', { name: 'task', exact: true });
    if (await taskChip.count() > 0) {
      await taskChip.click();
      await page.waitForTimeout(500);
    }
    await shot(page, '18-admin-filter-task');
  });

  test('19 ver dark mode toggle (botón ☽/☀ junto al user chip)', async ({ page }) => {
    await injectToken(page, ADMIN_TOKEN);
    await page.goto(`${BASE}/gantt`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2500);
    // Find theme toggle (typically a moon/sun icon button near user chip)
    const themeBtn = page.locator('button[aria-label*="tema" i], button[title*="tema" i], button:has-text("☽"), button:has-text("☀")').first();
    if (await themeBtn.count() > 0) {
      await themeBtn.click();
      await page.waitForTimeout(800);
      await shot(page, '19-admin-after-theme-toggle');
    } else {
      console.log('No theme toggle found');
      await shot(page, '19-admin-no-theme-toggle');
    }
  });

  test('20 viewport medio 1024px (laptop)', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await injectToken(page, ADMIN_TOKEN);
    await page.goto(`${BASE}/gantt`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2500);
    await shot(page, '20-laptop-1024');
  });

  test('21 viewport 900px (umbral mobile?)', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 700 });
    await injectToken(page, ADMIN_TOKEN);
    await page.goto(`${BASE}/gantt`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2500);
    await shot(page, '21-mid-900');
  });
});
