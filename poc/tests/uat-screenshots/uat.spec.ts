import { test, expect, Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.UAT_BASE_URL ?? 'https://demo.breisner.info/abax-gantt';
const ADMIN_TOKEN = process.env.AKADMIN_TOKEN ?? '';
const RESP_TOKEN = process.env.RESPONSABLE_TOKEN ?? '';
const EXEC_TOKEN = process.env.EJECUTOR_TOKEN ?? '';
const OUT = process.env.SCREENSHOT_DIR ?? join(process.cwd(), '..', 'docs', 'screenshots');

mkdirSync(OUT, { recursive: true });

async function injectToken(page: Page, token: string) {
  await page.goto(`${BASE}/login`);
  // Inyectar token + flag de sesión simulada que el frontend espera
  await page.evaluate(({ tok }) => {
    window.localStorage.setItem('abax.auth.token', tok);
    window.localStorage.setItem('abax.dev.session', JSON.stringify({
      user: { profile: { sub: 'session', email: 'session@local', name: 'Sesión Local' } },
    }));
  }, { tok: token });
}

async function shot(page: Page, name: string) {
  const path = join(OUT, `${name}.png`);
  await page.screenshot({ path, fullPage: false });
  console.log(`📸 ${name}.png`);
}

async function shotFull(page: Page, name: string) {
  const path = join(OUT, `${name}.png`);
  await page.screenshot({ path, fullPage: true });
  console.log(`📸 ${name}.png (full)`);
}

const console_msgs: { type: string; text: string }[] = [];
const net_errors: { url: string; status: number }[] = [];

test.beforeEach(async ({ page }) => {
  console_msgs.length = 0;
  net_errors.length = 0;
  page.on('console', m => {
    if (m.type() === 'error' || m.type() === 'warning') {
      console_msgs.push({ type: m.type(), text: m.text() });
    }
  });
  page.on('response', r => {
    if (r.status() >= 400 && r.url().includes('/api/')) {
      net_errors.push({ url: r.url(), status: r.status() });
    }
  });
});

test.afterEach(async ({}, info) => { // eslint-disable-line no-empty-pattern
  if (console_msgs.length) {
    console.log(`\n  ⚠️  Console messages durante ${info.title}:`);
    console_msgs.slice(0, 5).forEach(m => console.log(`     [${m.type}] ${m.text.slice(0, 200)}`));
  }
  if (net_errors.length) {
    console.log(`\n  ⚠️  Errores HTTP durante ${info.title}:`);
    net_errors.slice(0, 5).forEach(e => console.log(`     ${e.status} ${e.url}`));
  }
});

test.describe('UAT visual — Desktop 1440x900', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('01 login page', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.waitForLoadState('networkidle');
    await shot(page, '01-login-desktop');
  });

  test('02 admin gantt vacío (post-login)', async ({ page }) => {
    expect(ADMIN_TOKEN, 'AKADMIN_TOKEN no definido').toBeTruthy();
    await injectToken(page, ADMIN_TOKEN);
    await page.goto(`${BASE}/gantt`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // wait for DHTMLX gantt render
    await shot(page, '02-admin-gantt-desktop');
  });

  test('03 admin gantt con projectos', async ({ page }) => {
    await injectToken(page, ADMIN_TOKEN);
    await page.goto(`${BASE}/gantt`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    await shotFull(page, '03-admin-gantt-full');
  });

  test('04 admin abre detalle de nodo', async ({ page }) => {
    await injectToken(page, ADMIN_TOKEN);
    await page.goto(`${BASE}/gantt`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    // Intentar clickear el primer task row
    const firstTask = page.locator('.gantt_task_row, .gantt_row').first();
    if (await firstTask.count() > 0) {
      await firstTask.click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(800);
    }
    await shot(page, '04-admin-detail-panel');
  });

  test('05 admin filtros desplegados', async ({ page }) => {
    await injectToken(page, ADMIN_TOKEN);
    await page.goto(`${BASE}/gantt`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    // Si hay un botón de filtros, expandirlos
    const filterBtn = page.getByRole('button', { name: /filtro/i }).first();
    if (await filterBtn.count() > 0) {
      await filterBtn.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(500);
    }
    await shot(page, '05-admin-filterbar');
  });

  test('06 admin backlog panel', async ({ page }) => {
    await injectToken(page, ADMIN_TOKEN);
    await page.goto(`${BASE}/gantt`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    // Toggle backlog via Cmd+K (Ctrl+K)
    await page.keyboard.press('Control+k').catch(() => {});
    await page.waitForTimeout(500);
    await shot(page, '06-admin-backlog');
  });

  test('07 admin page de admin', async ({ page }) => {
    await injectToken(page, ADMIN_TOKEN);
    await page.goto(`${BASE}/admin`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await shot(page, '07-admin-users-page');
  });

  test('08 admin dialog crear proyecto', async ({ page }) => {
    await injectToken(page, ADMIN_TOKEN);
    await page.goto(`${BASE}/gantt`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    const btn = page.getByRole('button', { name: /\+ Proyecto|Proyecto|Crear proyecto/i }).first();
    if (await btn.count() > 0) {
      await btn.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(500);
    }
    await shot(page, '08-admin-create-project-dialog');
    await page.keyboard.press('Escape').catch(() => {});
  });

  test('09 admin light mode', async ({ page }) => {
    await injectToken(page, ADMIN_TOKEN);
    await page.addInitScript(() => localStorage.setItem('abax.theme', 'light'));
    await page.goto(`${BASE}/gantt`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2500);
    await shot(page, '09-admin-light-mode');
  });
});

test.describe('UAT visual — Roles', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('10 responsable view', async ({ page }) => {
    expect(RESP_TOKEN).toBeTruthy();
    await injectToken(page, RESP_TOKEN);
    await page.goto(`${BASE}/gantt`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2500);
    await shot(page, '10-responsable-view');
  });

  test('11 ejecutor mis tareas', async ({ page }) => {
    expect(EXEC_TOKEN).toBeTruthy();
    await injectToken(page, EXEC_TOKEN);
    await page.goto(`${BASE}/gantt?my=1`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2500);
    await shot(page, '11-ejecutor-mis-tareas');
  });
});

test.describe('UAT visual — Responsive', () => {
  test('12 mobile 375px login', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`${BASE}/login`);
    await page.waitForLoadState('networkidle');
    await shot(page, '12-mobile-login');
  });

  test('13 mobile 375px gantt', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await injectToken(page, ADMIN_TOKEN);
    await page.goto(`${BASE}/gantt`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2500);
    await shot(page, '13-mobile-gantt');
  });

  test('14 tablet 768px gantt', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await injectToken(page, ADMIN_TOKEN);
    await page.goto(`${BASE}/gantt`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2500);
    await shot(page, '14-tablet-gantt');
  });
});
