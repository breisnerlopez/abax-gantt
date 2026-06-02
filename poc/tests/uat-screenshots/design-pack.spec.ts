/**
 * design-pack.spec.ts
 *
 * Suite mock-driven que sirve capturas a estado actual del branch.
 * Datos sintéticos para que diseño pueda evaluar layout, densidad, dark mode, móvil, etc.
 */
import { test, type Page, type Route } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT = process.env.SCREENSHOT_DIR ?? join(process.cwd(), '..', 'docs', 'design-pack');
const BASE = process.env.UAT_BASE_URL ?? 'http://127.0.0.1:5173/abax-gantt';
mkdirSync(OUT, { recursive: true });

/* -------------------------- datos sintéticos -------------------------- */

function isoDay(offsetDays: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

const USERS = [
  { id: 'u-admin', email: 'admin@abax.local', full_name: 'Admin Demo', avatar_url: null, status: 'active', is_admin: true },
  { id: 'u-resp', email: 'responsable@abax.local', full_name: 'Lucía Responsable', avatar_url: null, status: 'active' },
  { id: 'u-exec1', email: 'maria@abax.local', full_name: 'María Ejecutora', avatar_url: null, status: 'active' },
  { id: 'u-exec2', email: 'carlos@abax.local', full_name: 'Carlos Ejecutor', avatar_url: null, status: 'active' },
  { id: 'u-exec3', email: 'ana@abax.local', full_name: 'Ana Ejecutora', avatar_url: null, status: 'active' },
];

const PROJECTS = [
  { id: 'p-sw', name: 'Sistema de Facturación v2', description: 'Migración a microservicios', status: 'active', budget_total: 250000 },
  { id: 'p-mkt', name: 'Campaña Q3 — Lanzamiento', description: 'Mercado LATAM', status: 'active', budget_total: 80000 },
  { id: 'p-build', name: 'Torre Polaris — Etapa 1', description: 'Cimentación y estructura', status: 'active', budget_total: 1500000 },
  { id: 'p-it', name: 'Migración a AWS', description: 'On-prem → cloud', status: 'active', budget_total: 120000 },
];

interface MockNode {
  id: string;
  project_id: string;
  parent_id: string | null;
  name: string;
  type: 'project' | 'stage' | 'group' | 'task' | 'milestone';
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  duration_days: number | null;
  progress: number | null;
  estimated_hours: number | null;
  estimated_cost: number | null;
  color: string | null;
  sort_order: number;
  responsible_id: string | null;
  is_unscheduled: boolean;
  status: string | null;
  path: string;
}

function buildNodes(): MockNode[] {
  const nodes: MockNode[] = [];

  // ----- Sistema de Facturación -----
  nodes.push(
    { id: 'sw-root', project_id: 'p-sw', parent_id: null, name: 'Sistema de Facturación v2', type: 'project', description: null, start_date: isoDay(-15), end_date: isoDay(45), duration_days: 60, progress: 0.42, estimated_hours: 800, estimated_cost: 250000, color: '#3b82f6', sort_order: 0, responsible_id: 'u-resp', is_unscheduled: false, status: 'en_progreso', path: 'sw_root' },
    { id: 'sw-disc', project_id: 'p-sw', parent_id: 'sw-root', name: 'Discovery & Arquitectura', type: 'stage', description: null, start_date: isoDay(-15), end_date: isoDay(-5), duration_days: 10, progress: 1, estimated_hours: 80, estimated_cost: 22000, color: null, sort_order: 0, responsible_id: 'u-resp', is_unscheduled: false, status: 'completado', path: 'sw_root.sw_disc' },
    { id: 'sw-disc-1', project_id: 'p-sw', parent_id: 'sw-disc', name: 'Entrevistas con stakeholders', type: 'task', description: null, start_date: isoDay(-15), end_date: isoDay(-10), duration_days: 5, progress: 1, estimated_hours: 40, estimated_cost: 8000, color: null, sort_order: 0, responsible_id: 'u-exec1', is_unscheduled: false, status: 'completado', path: 'sw_root.sw_disc.sw_disc_1' },
    { id: 'sw-disc-2', project_id: 'p-sw', parent_id: 'sw-disc', name: 'ADR: stack y eventos', type: 'task', description: null, start_date: isoDay(-10), end_date: isoDay(-5), duration_days: 5, progress: 1, estimated_hours: 40, estimated_cost: 14000, color: null, sort_order: 1, responsible_id: 'u-exec2', is_unscheduled: false, status: 'completado', path: 'sw_root.sw_disc.sw_disc_2' },
    { id: 'sw-build', project_id: 'p-sw', parent_id: 'sw-root', name: 'Construcción — backend', type: 'stage', description: null, start_date: isoDay(-5), end_date: isoDay(25), duration_days: 30, progress: 0.55, estimated_hours: 480, estimated_cost: 130000, color: null, sort_order: 1, responsible_id: 'u-exec2', is_unscheduled: false, status: 'en_progreso', path: 'sw_root.sw_build' },
    { id: 'sw-build-1', project_id: 'p-sw', parent_id: 'sw-build', name: 'Servicio Facturación', type: 'task', description: null, start_date: isoDay(-5), end_date: isoDay(10), duration_days: 15, progress: 0.8, estimated_hours: 160, estimated_cost: 45000, color: null, sort_order: 0, responsible_id: 'u-exec2', is_unscheduled: false, status: 'en_progreso', path: 'sw_root.sw_build.sw_build_1' },
    { id: 'sw-build-2', project_id: 'p-sw', parent_id: 'sw-build', name: 'Servicio Notificaciones', type: 'task', description: null, start_date: isoDay(0), end_date: isoDay(15), duration_days: 15, progress: 0.4, estimated_hours: 120, estimated_cost: 32000, color: null, sort_order: 1, responsible_id: 'u-exec3', is_unscheduled: false, status: 'en_progreso', path: 'sw_root.sw_build.sw_build_2' },
    { id: 'sw-build-3', project_id: 'p-sw', parent_id: 'sw-build', name: 'Integración pasarela', type: 'task', description: null, start_date: isoDay(10), end_date: isoDay(25), duration_days: 15, progress: 0, estimated_hours: 200, estimated_cost: 53000, color: null, sort_order: 2, responsible_id: 'u-exec2', is_unscheduled: false, status: 'pendiente', path: 'sw_root.sw_build.sw_build_3' },
    { id: 'sw-qa', project_id: 'p-sw', parent_id: 'sw-root', name: 'QA & UAT', type: 'stage', description: null, start_date: isoDay(20), end_date: isoDay(40), duration_days: 20, progress: 0, estimated_hours: 200, estimated_cost: 70000, color: null, sort_order: 2, responsible_id: 'u-exec1', is_unscheduled: false, status: 'pendiente', path: 'sw_root.sw_qa' },
    { id: 'sw-qa-1', project_id: 'p-sw', parent_id: 'sw-qa', name: 'Plan de pruebas', type: 'task', description: null, start_date: isoDay(20), end_date: isoDay(25), duration_days: 5, progress: 0, estimated_hours: 40, estimated_cost: 14000, color: null, sort_order: 0, responsible_id: 'u-exec1', is_unscheduled: false, status: 'pendiente', path: 'sw_root.sw_qa.sw_qa_1' },
    { id: 'sw-qa-2', project_id: 'p-sw', parent_id: 'sw-qa', name: 'UAT con clientes piloto', type: 'task', description: null, start_date: isoDay(25), end_date: isoDay(40), duration_days: 15, progress: 0, estimated_hours: 160, estimated_cost: 56000, color: null, sort_order: 1, responsible_id: 'u-resp', is_unscheduled: false, status: 'pendiente', path: 'sw_root.sw_qa.sw_qa_2' },
    { id: 'sw-go', project_id: 'p-sw', parent_id: 'sw-root', name: 'Go-Live', type: 'milestone', description: null, start_date: isoDay(45), end_date: isoDay(45), duration_days: 0, progress: 0, estimated_hours: 0, estimated_cost: 0, color: null, sort_order: 3, responsible_id: 'u-resp', is_unscheduled: false, status: 'pendiente', path: 'sw_root.sw_go' },
  );

  // ----- Campaña Q3 -----
  nodes.push(
    { id: 'mkt-root', project_id: 'p-mkt', parent_id: null, name: 'Campaña Q3 — Lanzamiento', type: 'project', description: null, start_date: isoDay(-7), end_date: isoDay(28), duration_days: 35, progress: 0.3, estimated_hours: 220, estimated_cost: 80000, color: '#f97316', sort_order: 0, responsible_id: 'u-resp', is_unscheduled: false, status: 'en_progreso', path: 'mkt_root' },
    { id: 'mkt-brand', project_id: 'p-mkt', parent_id: 'mkt-root', name: 'Brand & creatividades', type: 'stage', description: null, start_date: isoDay(-7), end_date: isoDay(7), duration_days: 14, progress: 0.65, estimated_hours: 80, estimated_cost: 25000, color: null, sort_order: 0, responsible_id: 'u-exec1', is_unscheduled: false, status: 'en_progreso', path: 'mkt_root.mkt_brand' },
    { id: 'mkt-brand-1', project_id: 'p-mkt', parent_id: 'mkt-brand', name: 'Moodboard y dirección', type: 'task', description: null, start_date: isoDay(-7), end_date: isoDay(-3), duration_days: 4, progress: 1, estimated_hours: 20, estimated_cost: 6000, color: null, sort_order: 0, responsible_id: 'u-exec1', is_unscheduled: false, status: 'completado', path: 'mkt_root.mkt_brand.mkt_brand_1' },
    { id: 'mkt-brand-2', project_id: 'p-mkt', parent_id: 'mkt-brand', name: 'Piezas para redes', type: 'task', description: null, start_date: isoDay(-3), end_date: isoDay(7), duration_days: 10, progress: 0.5, estimated_hours: 60, estimated_cost: 19000, color: null, sort_order: 1, responsible_id: 'u-exec1', is_unscheduled: false, status: 'en_progreso', path: 'mkt_root.mkt_brand.mkt_brand_2' },
    { id: 'mkt-paid', project_id: 'p-mkt', parent_id: 'mkt-root', name: 'Paid media', type: 'stage', description: null, start_date: isoDay(3), end_date: isoDay(28), duration_days: 25, progress: 0.1, estimated_hours: 80, estimated_cost: 35000, color: null, sort_order: 1, responsible_id: 'u-exec3', is_unscheduled: false, status: 'retrasado', path: 'mkt_root.mkt_paid' },
    { id: 'mkt-paid-1', project_id: 'p-mkt', parent_id: 'mkt-paid', name: 'Setup Meta Ads', type: 'task', description: null, start_date: isoDay(3), end_date: isoDay(10), duration_days: 7, progress: 0.3, estimated_hours: 30, estimated_cost: 12000, color: null, sort_order: 0, responsible_id: 'u-exec3', is_unscheduled: false, status: 'retrasado', path: 'mkt_root.mkt_paid.mkt_paid_1' },
    { id: 'mkt-paid-2', project_id: 'p-mkt', parent_id: 'mkt-paid', name: 'Optimización continua', type: 'task', description: null, start_date: isoDay(10), end_date: isoDay(28), duration_days: 18, progress: 0, estimated_hours: 50, estimated_cost: 23000, color: null, sort_order: 1, responsible_id: 'u-exec3', is_unscheduled: false, status: 'pendiente', path: 'mkt_root.mkt_paid.mkt_paid_2' },
    { id: 'mkt-event', project_id: 'p-mkt', parent_id: 'mkt-root', name: 'Evento de lanzamiento', type: 'milestone', description: null, start_date: isoDay(28), end_date: isoDay(28), duration_days: 0, progress: 0, estimated_hours: 0, estimated_cost: 0, color: null, sort_order: 2, responsible_id: 'u-resp', is_unscheduled: false, status: 'pendiente', path: 'mkt_root.mkt_event' },
  );

  // ----- Torre Polaris -----
  nodes.push(
    { id: 'b-root', project_id: 'p-build', parent_id: null, name: 'Torre Polaris — Etapa 1', type: 'project', description: null, start_date: isoDay(-30), end_date: isoDay(120), duration_days: 150, progress: 0.25, estimated_hours: 12000, estimated_cost: 1500000, color: '#16a34a', sort_order: 0, responsible_id: 'u-resp', is_unscheduled: false, status: 'en_progreso', path: 'b_root' },
    { id: 'b-perm', project_id: 'p-build', parent_id: 'b-root', name: 'Permisos y licencias', type: 'stage', description: null, start_date: isoDay(-30), end_date: isoDay(-15), duration_days: 15, progress: 1, estimated_hours: 200, estimated_cost: 40000, color: null, sort_order: 0, responsible_id: 'u-resp', is_unscheduled: false, status: 'completado', path: 'b_root.b_perm' },
    { id: 'b-mov', project_id: 'p-build', parent_id: 'b-root', name: 'Movimiento de tierras', type: 'stage', description: null, start_date: isoDay(-15), end_date: isoDay(10), duration_days: 25, progress: 0.85, estimated_hours: 1800, estimated_cost: 220000, color: null, sort_order: 1, responsible_id: 'u-exec2', is_unscheduled: false, status: 'en_progreso', path: 'b_root.b_mov' },
    { id: 'b-mov-1', project_id: 'p-build', parent_id: 'b-mov', name: 'Excavación', type: 'task', description: null, start_date: isoDay(-15), end_date: isoDay(0), duration_days: 15, progress: 1, estimated_hours: 1000, estimated_cost: 120000, color: null, sort_order: 0, responsible_id: 'u-exec2', is_unscheduled: false, status: 'completado', path: 'b_root.b_mov.b_mov_1' },
    { id: 'b-mov-2', project_id: 'p-build', parent_id: 'b-mov', name: 'Compactación', type: 'task', description: null, start_date: isoDay(0), end_date: isoDay(10), duration_days: 10, progress: 0.5, estimated_hours: 800, estimated_cost: 100000, color: null, sort_order: 1, responsible_id: 'u-exec2', is_unscheduled: false, status: 'en_progreso', path: 'b_root.b_mov.b_mov_2' },
    { id: 'b-cim', project_id: 'p-build', parent_id: 'b-root', name: 'Cimentación', type: 'stage', description: null, start_date: isoDay(10), end_date: isoDay(50), duration_days: 40, progress: 0, estimated_hours: 3000, estimated_cost: 450000, color: null, sort_order: 2, responsible_id: 'u-exec3', is_unscheduled: false, status: 'pendiente', path: 'b_root.b_cim' },
    { id: 'b-cim-1', project_id: 'p-build', parent_id: 'b-cim', name: 'Armado de plintos', type: 'task', description: null, start_date: isoDay(10), end_date: isoDay(25), duration_days: 15, progress: 0, estimated_hours: 1200, estimated_cost: 180000, color: null, sort_order: 0, responsible_id: 'u-exec3', is_unscheduled: false, status: 'pendiente', path: 'b_root.b_cim.b_cim_1' },
    { id: 'b-cim-2', project_id: 'p-build', parent_id: 'b-cim', name: 'Vertido hormigón', type: 'task', description: null, start_date: isoDay(25), end_date: isoDay(50), duration_days: 25, progress: 0, estimated_hours: 1800, estimated_cost: 270000, color: null, sort_order: 1, responsible_id: 'u-exec3', is_unscheduled: false, status: 'pendiente', path: 'b_root.b_cim.b_cim_2' },
    { id: 'b-est', project_id: 'p-build', parent_id: 'b-root', name: 'Estructura', type: 'stage', description: null, start_date: isoDay(50), end_date: isoDay(120), duration_days: 70, progress: 0, estimated_hours: 7000, estimated_cost: 790000, color: null, sort_order: 3, responsible_id: 'u-exec2', is_unscheduled: false, status: 'pendiente', path: 'b_root.b_est' },
  );

  // ----- Migración AWS -----
  nodes.push(
    { id: 'it-root', project_id: 'p-it', parent_id: null, name: 'Migración a AWS', type: 'project', description: null, start_date: isoDay(-10), end_date: isoDay(60), duration_days: 70, progress: 0.5, estimated_hours: 600, estimated_cost: 120000, color: '#a855f7', sort_order: 0, responsible_id: 'u-resp', is_unscheduled: false, status: 'en_progreso', path: 'it_root' },
    { id: 'it-assess', project_id: 'p-it', parent_id: 'it-root', name: 'Assessment', type: 'stage', description: null, start_date: isoDay(-10), end_date: isoDay(0), duration_days: 10, progress: 1, estimated_hours: 80, estimated_cost: 18000, color: null, sort_order: 0, responsible_id: 'u-exec1', is_unscheduled: false, status: 'completado', path: 'it_root.it_assess' },
    { id: 'it-net', project_id: 'p-it', parent_id: 'it-root', name: 'VPC & networking', type: 'stage', description: null, start_date: isoDay(0), end_date: isoDay(20), duration_days: 20, progress: 0.7, estimated_hours: 160, estimated_cost: 32000, color: null, sort_order: 1, responsible_id: 'u-exec2', is_unscheduled: false, status: 'en_progreso', path: 'it_root.it_net' },
    { id: 'it-net-1', project_id: 'p-it', parent_id: 'it-net', name: 'Diseño de VPCs', type: 'task', description: null, start_date: isoDay(0), end_date: isoDay(7), duration_days: 7, progress: 1, estimated_hours: 50, estimated_cost: 10000, color: null, sort_order: 0, responsible_id: 'u-exec2', is_unscheduled: false, status: 'completado', path: 'it_root.it_net.it_net_1' },
    { id: 'it-net-2', project_id: 'p-it', parent_id: 'it-net', name: 'Setup peering & TGW', type: 'task', description: null, start_date: isoDay(7), end_date: isoDay(20), duration_days: 13, progress: 0.6, estimated_hours: 110, estimated_cost: 22000, color: null, sort_order: 1, responsible_id: 'u-exec3', is_unscheduled: false, status: 'en_progreso', path: 'it_root.it_net.it_net_2' },
    { id: 'it-mig', project_id: 'p-it', parent_id: 'it-root', name: 'Migración de cargas', type: 'stage', description: null, start_date: isoDay(20), end_date: isoDay(55), duration_days: 35, progress: 0.1, estimated_hours: 300, estimated_cost: 60000, color: null, sort_order: 2, responsible_id: 'u-exec1', is_unscheduled: false, status: 'pendiente', path: 'it_root.it_mig' },
    { id: 'it-mig-1', project_id: 'p-it', parent_id: 'it-mig', name: 'Base de datos prod', type: 'task', description: null, start_date: isoDay(20), end_date: isoDay(35), duration_days: 15, progress: 0.2, estimated_hours: 150, estimated_cost: 30000, color: null, sort_order: 0, responsible_id: 'u-exec1', is_unscheduled: false, status: 'en_progreso', path: 'it_root.it_mig.it_mig_1' },
    { id: 'it-mig-2', project_id: 'p-it', parent_id: 'it-mig', name: 'Servicios app', type: 'task', description: null, start_date: isoDay(35), end_date: isoDay(55), duration_days: 20, progress: 0, estimated_hours: 150, estimated_cost: 30000, color: null, sort_order: 1, responsible_id: 'u-exec1', is_unscheduled: false, status: 'pendiente', path: 'it_root.it_mig.it_mig_2' },
    { id: 'it-cut', project_id: 'p-it', parent_id: 'it-root', name: 'Cut-over', type: 'milestone', description: null, start_date: isoDay(60), end_date: isoDay(60), duration_days: 0, progress: 0, estimated_hours: 0, estimated_cost: 0, color: null, sort_order: 3, responsible_id: 'u-resp', is_unscheduled: false, status: 'pendiente', path: 'it_root.it_cut' },
  );

  return nodes;
}

const NODES = buildNodes();

const BACKLOG: MockNode[] = [
  { id: 'bl-1', project_id: 'p-sw', parent_id: null, name: 'API de webhooks (backlog)', type: 'task', description: null, start_date: null, end_date: null, duration_days: null, progress: 0, estimated_hours: 60, estimated_cost: 18000, color: null, sort_order: 0, responsible_id: 'u-exec2', is_unscheduled: true, status: 'pendiente', path: 'bl_1' },
  { id: 'bl-2', project_id: 'p-mkt', parent_id: null, name: 'Newsletter mensual', type: 'task', description: null, start_date: null, end_date: null, duration_days: null, progress: 0, estimated_hours: 20, estimated_cost: 4000, color: null, sort_order: 1, responsible_id: 'u-exec1', is_unscheduled: true, status: 'pendiente', path: 'bl_2' },
  { id: 'bl-3', project_id: 'p-it', parent_id: null, name: 'Disaster recovery plan', type: 'task', description: null, start_date: null, end_date: null, duration_days: null, progress: 0, estimated_hours: 80, estimated_cost: 20000, color: null, sort_order: 2, responsible_id: 'u-resp', is_unscheduled: true, status: 'pendiente', path: 'bl_3' },
  { id: 'bl-4', project_id: 'p-build', parent_id: null, name: 'Estudio impacto vecinal', type: 'task', description: null, start_date: null, end_date: null, duration_days: null, progress: 0, estimated_hours: 40, estimated_cost: 15000, color: null, sort_order: 3, responsible_id: 'u-exec3', is_unscheduled: true, status: 'pendiente', path: 'bl_4' },
];

const DEPENDENCIES = [
  { id: 'd-sw-1', predecessor_id: 'sw-disc', successor_id: 'sw-build', type: 'FS' as const },
  { id: 'd-sw-2', predecessor_id: 'sw-build-1', successor_id: 'sw-build-3', type: 'FS' as const },
  { id: 'd-sw-3', predecessor_id: 'sw-build', successor_id: 'sw-qa', type: 'FS' as const },
  { id: 'd-sw-4', predecessor_id: 'sw-qa', successor_id: 'sw-go', type: 'FS' as const },
  { id: 'd-b-1', predecessor_id: 'b-perm', successor_id: 'b-mov', type: 'FS' as const },
  { id: 'd-b-2', predecessor_id: 'b-mov', successor_id: 'b-cim', type: 'FS' as const },
  { id: 'd-b-3', predecessor_id: 'b-cim', successor_id: 'b-est', type: 'FS' as const },
  { id: 'd-it-1', predecessor_id: 'it-assess', successor_id: 'it-net', type: 'FS' as const },
  { id: 'd-it-2', predecessor_id: 'it-net', successor_id: 'it-mig', type: 'FS' as const },
  { id: 'd-it-3', predecessor_id: 'it-mig', successor_id: 'it-cut', type: 'FS' as const },
];

const SUMMARY = {
  active_projects: 4,
  total_projects: 4,
  global_progress: 0.36,
  upcoming_milestones_count: 3,
  total_budget: 1950000,
  total_estimated_cost: 1820000,
  budget_consumed_pct: 0.42,
  total_tasks: NODES.filter((n) => n.type === 'task').length,
  unscheduled_tasks: BACKLOG.length,
};

/* -------------------------- helpers -------------------------- */

async function mockApi(page: Page) {
  await page.route('**/api/**', async (route: Route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^.*\/api\//, 'api/').split('?')[0];
    const method = route.request().method();

    if (method !== 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: {} }) });
    }

    if (path === 'api/projects') return json(route, PROJECTS);
    if (path === 'api/users') return json(route, USERS);
    if (path === 'api/wbs') return json(route, NODES);
    if (path === 'api/backlog') return json(route, BACKLOG);
    if (path === 'api/dependencies') return json(route, DEPENDENCIES);
    if (path === 'api/summary') return json(route, SUMMARY);
    if (path === 'api/admin/users') return json(route, USERS);
    if (path === 'api/assignees') return json(route, []);
    if (path.startsWith('api/attachments')) return json(route, []);

    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [], count: 0 }) });
  });
}

async function json(route: Route, data: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify({ data, count: Array.isArray(data) ? data.length : undefined }),
  });
}

async function setup(page: Page, opts?: { theme?: 'light' | 'dark' }) {
  await mockApi(page);
  await page.addInitScript((theme) => {
    window.localStorage.setItem('abax.auth.token', 'demo-token');
    if (theme) window.localStorage.setItem('abax.theme', theme);
  }, opts?.theme ?? null);
}

async function gotoGantt(page: Page, query = '') {
  await page.goto(`${BASE}/gantt${query}`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
}

async function shot(page: Page, name: string, full = false) {
  const path = join(OUT, `${name}.png`);
  await page.screenshot({ path, fullPage: full });
}

/* -------------------------- specs -------------------------- */

test.describe('Design pack — Desktop 1440x900', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('01 login', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.waitForLoadState('networkidle');
    await shot(page, '01-login-desktop');
  });

  test('02 portfolio 4 proyectos', async ({ page }) => {
    await setup(page);
    await gotoGantt(page);
    await shot(page, '02-portfolio-4-proyectos');
  });

  test('03 portfolio full page', async ({ page }) => {
    await setup(page);
    await gotoGantt(page);
    await shot(page, '03-portfolio-full', true);
  });

  test('04 dark mode portfolio', async ({ page }) => {
    await setup(page, { theme: 'dark' });
    await gotoGantt(page);
    await shot(page, '04-portfolio-dark');
  });

  test('05 foco software', async ({ page }) => {
    await setup(page);
    await gotoGantt(page, '?focus=p-sw');
    await shot(page, '05-foco-software');
  });

  test('06 foco marketing', async ({ page }) => {
    await setup(page);
    await gotoGantt(page, '?focus=p-mkt');
    await shot(page, '06-foco-marketing');
  });

  test('07 foco construccion con dependencias', async ({ page }) => {
    await setup(page);
    await gotoGantt(page, '?focus=p-build');
    await shot(page, '07-foco-construccion');
  });

  test('08 foco TI', async ({ page }) => {
    await setup(page);
    await gotoGantt(page, '?focus=p-it');
    await shot(page, '08-foco-ti');
  });

  test('09 filtro status retrasado', async ({ page }) => {
    await setup(page);
    await gotoGantt(page, '?status=retrasado');
    await shot(page, '09-filtro-retrasado');
  });

  test('10 detail panel abierto', async ({ page }) => {
    await setup(page);
    await page.addInitScript(() => window.localStorage.setItem('abax.detail.visible', '1'));
    await gotoGantt(page, '?focus=p-sw');
    // Click sobre la primera barra de tarea
    const firstRow = page.locator('.gantt_row').nth(1);
    if (await firstRow.count() > 0) {
      await firstRow.click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(800);
    }
    await shot(page, '10-detail-abierto');
  });

  test('11 detail panel cerrado', async ({ page }) => {
    await setup(page);
    await page.addInitScript(() => window.localStorage.setItem('abax.detail.visible', '0'));
    await gotoGantt(page, '?focus=p-sw');
    await shot(page, '11-detail-cerrado');
  });

  test('12 shortcuts modal', async ({ page }) => {
    await setup(page);
    await gotoGantt(page);
    await page.keyboard.press('Shift+/').catch(() => {});
    await page.waitForTimeout(500);
    await shot(page, '12-shortcuts-modal');
  });

  test('13 crear proyecto dialog', async ({ page }) => {
    await setup(page);
    await gotoGantt(page);
    const btn = page.getByRole('button', { name: /\+ Proyecto|Proyecto/i }).first();
    if (await btn.count() > 0) {
      await btn.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(400);
    }
    await shot(page, '13-crear-proyecto-dialog');
  });

  test('14 escala día', async ({ page }) => {
    await setup(page);
    await gotoGantt(page, '?focus=p-sw&scale=D%C3%ADa');
    await shot(page, '14-escala-dia');
  });

  test('15 escala mes', async ({ page }) => {
    await setup(page);
    await gotoGantt(page, '?focus=p-build&scale=Mes');
    await shot(page, '15-escala-mes');
  });

  test('16 unscheduled visible', async ({ page }) => {
    await setup(page);
    await gotoGantt(page, '?unscheduled=1');
    await shot(page, '16-unscheduled');
  });

  test('17 admin users page', async ({ page }) => {
    await setup(page);
    await page.goto(`${BASE}/admin`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1200);
    await shot(page, '17-admin-users');
  });

  test('18 admin users dark', async ({ page }) => {
    await setup(page, { theme: 'dark' });
    await page.goto(`${BASE}/admin`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1200);
    await shot(page, '18-admin-users-dark');
  });

  test('19 backlog panel', async ({ page }) => {
    await setup(page);
    await gotoGantt(page);
    // Try to open backlog rail
    const railBtn = page.locator('.backlog-rail-toggle, [aria-label*=acklog]').first();
    if (await railBtn.count() > 0) {
      await railBtn.click().catch(() => {});
      await page.waitForTimeout(500);
    }
    await shot(page, '19-backlog-panel');
  });
});

test.describe('Design pack — Laptop 1280x800', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('20 portfolio laptop', async ({ page }) => {
    await setup(page);
    await gotoGantt(page);
    await shot(page, '20-portfolio-laptop');
  });

  test('21 foco sw laptop', async ({ page }) => {
    await setup(page);
    await gotoGantt(page, '?focus=p-sw');
    await shot(page, '21-foco-sw-laptop');
  });
});

test.describe('Design pack — Tablet 768x1024', () => {
  test.use({ viewport: { width: 768, height: 1024 } });

  test('22 portfolio tablet', async ({ page }) => {
    await setup(page);
    await gotoGantt(page);
    await shot(page, '22-portfolio-tablet');
  });

  test('23 foco construccion tablet', async ({ page }) => {
    await setup(page);
    await gotoGantt(page, '?focus=p-build');
    await shot(page, '23-foco-construccion-tablet');
  });

  test('24 detail tablet', async ({ page }) => {
    await setup(page);
    await page.addInitScript(() => window.localStorage.setItem('abax.detail.visible', '1'));
    await gotoGantt(page, '?focus=p-sw');
    const row = page.locator('.gantt_row').nth(1);
    if (await row.count() > 0) {
      await row.click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(600);
    }
    await shot(page, '24-detail-tablet');
  });
});

test.describe('Design pack — Mobile 390x844', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('25 login mobile', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.waitForLoadState('networkidle');
    await shot(page, '25-login-mobile');
  });

  test('26 mobile list por defecto', async ({ page }) => {
    await setup(page);
    await gotoGantt(page);
    await shot(page, '26-mobile-list');
  });

  test('27 mobile dark', async ({ page }) => {
    await setup(page, { theme: 'dark' });
    await gotoGantt(page);
    await shot(page, '27-mobile-list-dark');
  });

  test('28 mobile foco proyecto', async ({ page }) => {
    await setup(page);
    await gotoGantt(page, '?focus=p-sw');
    await shot(page, '28-mobile-foco-sw');
  });

  test('29 mobile gantt forzado', async ({ page }) => {
    await setup(page);
    await page.addInitScript(() => window.localStorage.setItem('abax.mobile.gantt', '1'));
    await gotoGantt(page, '?focus=p-sw');
    await shot(page, '29-mobile-gantt-forzado');
  });

  test('30 mobile backlog', async ({ page }) => {
    await setup(page);
    await gotoGantt(page, '?unscheduled=1');
    await shot(page, '30-mobile-backlog');
  });
});

test.describe('Design pack — XL desktop 1920x1080', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test('31 portfolio 1920', async ({ page }) => {
    await setup(page);
    await gotoGantt(page);
    await shot(page, '31-portfolio-xl');
  });

  test('32 foco construccion 1920 dark', async ({ page }) => {
    await setup(page, { theme: 'dark' });
    await gotoGantt(page, '?focus=p-build');
    await shot(page, '32-construccion-xl-dark');
  });
});
