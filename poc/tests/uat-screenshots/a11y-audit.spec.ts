/**
 * Auditoría a11y AA con axe-core sobre las pantallas clave del rediseño.
 * Solo lectura — reporta violations por consola y al test output. No falla
 * los tests (los hallazgos críticos sí lo harían; aquí queremos visibilidad).
 *
 * Reutiliza el mismo mock-api que design-pack.spec.ts (datos sintéticos).
 */
import { test, expect, type Page, type Route } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';

const BASE = process.env.UAT_BASE_URL ?? 'http://127.0.0.1:5173/abax-gantt';

function isoDay(offsetDays: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

const USERS = [
  { id: 'u-admin', email: 'admin@a.local', full_name: 'Admin Demo', avatar_url: null, status: 'active', is_admin: true },
  { id: 'u-resp', email: 'lucia@a.local', full_name: 'Lucía Responsable', avatar_url: null, status: 'active' },
  { id: 'u-exec', email: 'maria@a.local', full_name: 'María Ejecutora', avatar_url: null, status: 'active' },
];

const PROJECTS = [
  { id: 'p-sw', name: 'Sistema de Facturación v2', description: null, status: 'active', budget_total: 250000 },
  { id: 'p-mkt', name: 'Campaña Q3', description: null, status: 'active', budget_total: 80000 },
];

const NODES = [
  { id: 'sw-root', project_id: 'p-sw', parent_id: null, name: 'Sistema de Facturación v2', type: 'project', description: null, start_date: isoDay(-15), end_date: isoDay(45), duration_days: 60, progress: 0.42, estimated_hours: 800, estimated_cost: 250000, color: '#3b82f6', sort_order: 0, responsible_id: 'u-resp', is_unscheduled: false, status: 'en_progreso', path: 'sw_root' },
  { id: 'sw-1', project_id: 'p-sw', parent_id: 'sw-root', name: 'Discovery', type: 'stage', description: null, start_date: isoDay(-15), end_date: isoDay(-5), duration_days: 10, progress: 1, estimated_hours: 80, estimated_cost: 22000, color: null, sort_order: 0, responsible_id: 'u-resp', is_unscheduled: false, status: 'completado', path: 'sw_root.sw_1' },
  { id: 'sw-2', project_id: 'p-sw', parent_id: 'sw-root', name: 'Construcción', type: 'stage', description: null, start_date: isoDay(-5), end_date: isoDay(25), duration_days: 30, progress: 0.55, estimated_hours: 480, estimated_cost: 130000, color: null, sort_order: 1, responsible_id: 'u-exec', is_unscheduled: false, status: 'en_progreso', path: 'sw_root.sw_2' },
  { id: 'mkt-root', project_id: 'p-mkt', parent_id: null, name: 'Campaña Q3', type: 'project', description: null, start_date: isoDay(-7), end_date: isoDay(28), duration_days: 35, progress: 0.3, estimated_hours: 220, estimated_cost: 80000, color: '#f97316', sort_order: 0, responsible_id: 'u-resp', is_unscheduled: false, status: 'retrasado', path: 'mkt_root' },
];

async function mockApi(page: Page) {
  await page.route('**/api/**', async (route: Route) => {
    const path = new URL(route.request().url()).pathname.replace(/^.*\/api\//, 'api/').split('?')[0];
    const json = (data: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data, count: Array.isArray(data) ? data.length : undefined }) });
    if (path === 'api/projects') return json(PROJECTS);
    if (path === 'api/users') return json(USERS);
    if (path === 'api/wbs') return json(NODES);
    if (path === 'api/backlog') return json([]);
    if (path === 'api/dependencies') return json([]);
    if (path === 'api/summary') return json({ active_projects: 2, total_projects: 2, global_progress: 0.36, upcoming_milestones_count: 0, total_budget: 330000, total_estimated_cost: 252000, budget_consumed_pct: 0.42, total_tasks: 2, unscheduled_tasks: 0 });
    if (path === 'api/admin/users') return json(USERS);
    return json([]);
  });
}

interface Hit {
  page: string;
  theme: 'light' | 'dark';
  id: string;
  impact: string | null;
  description: string;
  nodes: number;
  targets: string[];
}

const ALL_HITS: Hit[] = [];

async function audit(page: Page, pageName: string, theme: 'light' | 'dark') {
  const builder = new AxeBuilder({ page })
    // WCAG 2.1 AA es lo que pide el handoff §8
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    // Excluimos el iframe interno de DHTMLX y la región del Gantt (motor de
    // terceros, no rediseñable más allá del skin). El interés está en el
    // chrome propio (topbar, filterbar, detail, mobile, admin).
    .exclude('.gantt_container')
    .exclude('iframe');
  const res = await builder.analyze();
  for (const v of res.violations) {
    ALL_HITS.push({
      page: pageName,
      theme,
      id: v.id,
      impact: v.impact ?? null,
      description: v.help,
      nodes: v.nodes.length,
      targets: v.nodes.slice(0, 6).map((n) => n.target.join(' › ')),
    });
  }
}

async function setup(page: Page, opts?: { theme?: 'dark' }) {
  await mockApi(page);
  await page.addInitScript((t) => {
    window.localStorage.setItem('abax.auth.token', 'demo');
    if (t) window.localStorage.setItem('abax.theme', t);
  }, opts?.theme ?? null);
}

test.describe.configure({ mode: 'serial' });

test.describe('a11y AA — light', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('login', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.waitForLoadState('networkidle');
    await audit(page, 'login', 'light');
  });

  test('portfolio', async ({ page }) => {
    await setup(page);
    await page.goto(`${BASE}/gantt`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await audit(page, 'portfolio', 'light');
  });

  test('admin', async ({ page }) => {
    await setup(page);
    await page.goto(`${BASE}/admin`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await audit(page, 'admin', 'light');
  });
});

test.describe('a11y AA — dark', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('portfolio dark', async ({ page }) => {
    await setup(page, { theme: 'dark' });
    await page.goto(`${BASE}/gantt`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await audit(page, 'portfolio', 'dark');
  });

  test('admin dark', async ({ page }) => {
    await setup(page, { theme: 'dark' });
    await page.goto(`${BASE}/admin`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await audit(page, 'admin', 'dark');
  });
});

test.describe('a11y AA — mobile', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('mobile tasks', async ({ page }) => {
    await setup(page);
    await page.goto(`${BASE}/gantt`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await audit(page, 'mobile-tasks', 'light');
  });
});

test.afterAll(async () => {
  console.log('\n========================================');
  console.log('  AXE-CORE WCAG 2.1 AA — REPORT');
  console.log('========================================');
  if (ALL_HITS.length === 0) {
    console.log('  ✅ Sin violaciones AA detectadas.');
    return;
  }
  // Agrupa por regla
  const byRule = new Map<string, Hit[]>();
  for (const h of ALL_HITS) {
    const arr = byRule.get(h.id) ?? [];
    arr.push(h);
    byRule.set(h.id, arr);
  }
  for (const [id, hits] of [...byRule.entries()].sort()) {
    const impact = hits[0]!.impact ?? 'minor';
    console.log(`\n  [${impact.toUpperCase()}]  ${id}`);
    console.log(`    ${hits[0]!.description}`);
    console.log(`    Páginas:`);
    for (const h of hits) {
      console.log(`      • ${h.page} (${h.theme}) — ${h.nodes} nodos`);
      for (const t of h.targets) console.log(`          ↳ ${t}`);
    }
  }
  console.log('\n========================================\n');
  // Falla si hay critical/serious
  const blocking = ALL_HITS.filter((h) => h.impact === 'critical' || h.impact === 'serious');
  expect.soft(blocking, `${blocking.length} violación(es) critical/serious — ver report arriba`).toEqual([]);
});
