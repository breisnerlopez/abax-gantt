import { test, Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.UAT_BASE_URL ?? 'https://demo.breisner.info/abax-gantt';
const ADMIN_TOKEN = process.env.AKADMIN_TOKEN ?? '';
const OUT = process.env.SCREENSHOT_DIR ?? join(process.cwd(), '..', 'docs', 'screenshots');
mkdirSync(OUT, { recursive: true });

async function inject(page: Page) {
  await page.goto(`${BASE}/login`);
  await page.evaluate((tok) => window.localStorage.setItem('abax.auth.token', tok), ADMIN_TOKEN);
}

const PROJECTS = [
  { id: '11111111-1111-1111-1111-111111111111', slug: 'sw',          label: 'Sistema de Facturación' },
  { id: '22222222-2222-2222-2222-222222222222', slug: 'marketing',   label: 'Campaña Q3' },
  { id: '33333333-3333-3333-3333-333333333333', slug: 'construccion', label: 'Torre Polaris' },
  { id: '44444444-4444-4444-4444-444444444444', slug: 'ti',          label: 'Migración AWS' },
];

test.describe('Demo de 4 proyectos variados', () => {
  test.use({ viewport: { width: 1600, height: 1000 } });

  test('30 portfolio general', async ({ page }) => {
    await inject(page);
    await page.goto(`${BASE}/gantt`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: join(OUT, '30-portfolio-4-proyectos.png'), fullPage: false });
  });

  for (let i = 0; i < PROJECTS.length; i++) {
    const p = PROJECTS[i]!;
    test(`3${i + 1} foco proyecto - ${p.label}`, async ({ page }) => {
      await inject(page);
      await page.goto(`${BASE}/gantt?focus=${p.id}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3500);
      await page.screenshot({ path: join(OUT, `3${i + 1}-${p.slug}-foco.png`), fullPage: false });
    });
  }

  test('35 dark mode portfolio', async ({ page }) => {
    await inject(page);
    await page.addInitScript(() => localStorage.setItem('abax.theme', 'dark'));
    await page.goto(`${BASE}/gantt`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: join(OUT, '35-portfolio-dark.png'), fullPage: false });
  });

  test('36 backlog agrupado por proyecto', async ({ page }) => {
    await inject(page);
    await page.goto(`${BASE}/gantt`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2500);
    // Toggle backlog vía botón
    const railBtn = page.locator('.backlog-rail-toggle').first();
    if (await railBtn.count() > 0) {
      await railBtn.click();
      await page.waitForTimeout(600);
    }
    await page.screenshot({ path: join(OUT, '36-backlog-agrupado.png'), fullPage: false });
  });

  test('37 dependencias visibles construcción', async ({ page }) => {
    await inject(page);
    await page.goto(`${BASE}/gantt?focus=${PROJECTS[2]!.id}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3500);
    await page.screenshot({ path: join(OUT, '37-construccion-dependencias.png'), fullPage: true });
  });

  test('38 filtro status retrasado', async ({ page }) => {
    await inject(page);
    await page.goto(`${BASE}/gantt?status=retrasado`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2500);
    await page.screenshot({ path: join(OUT, '38-filtro-retrasado.png'), fullPage: false });
  });
});
