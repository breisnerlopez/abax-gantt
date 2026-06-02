/**
 * Agrupación de proyectos para el portafolio (handoff §5.2).
 *
 * Inserta "cabeceras sintéticas" como nodos virtuales de tipo "group"
 * encima de los proyectos que comparten clave de agrupación. Las cabeceras
 * son colapsables vía DHTMLX igual que cualquier otro grupo, pero su id
 * está prefijado para que el resto de la app pueda ignorarlas (no son
 * persistibles, no participan en drag-drop, no abren panel de detalle).
 *
 * Mantiene la jerarquía interna de cada proyecto intacta — sólo cambia
 * `parent_id` del nodo raíz del proyecto para que cuelgue del grupo.
 *
 * Modes:
 * - `responsible` (Fase 7) — agrupa por `responsible_id` del proyecto.
 * - `team`        (Fase 9) — agrupa por `team_id` del proyecto (requiere
 *                            que `loadPortfolio` haya traído `teams`).
 */
import type { Profile, Project, Team, WbsNode } from './types';

export type GroupBy = 'none' | 'responsible' | 'team';

const RESP_PREFIX = '__resp__';
const TEAM_PREFIX = '__team__';
const UNASSIGNED_KEY = '__unassigned__';

export function isSyntheticGroupId(id: string | null | undefined): boolean {
  return !!id && (id.startsWith(RESP_PREFIX) || id.startsWith(TEAM_PREFIX));
}

export interface ApplyGroupByContext {
  users: Profile[];
  teams?: Team[];
  projects?: Project[];
}

/**
 * Aplica la agrupación al árbol filtrado. Devuelve una NUEVA lista, no muta.
 * Si `groupBy === 'none'` o no hay nada útil que agrupar, devuelve `nodes` tal cual.
 */
export function applyGroupBy(nodes: WbsNode[], groupBy: GroupBy, ctx: ApplyGroupByContext): WbsNode[] {
  if (groupBy === 'none') return nodes;
  if (nodes.length === 0) return nodes;

  // Identificar nodos raíz (proyectos): parent_id null y existen en el pool.
  const ids = new Set(nodes.map((n) => n.id));
  const roots = nodes.filter((n) => n.parent_id === null || !ids.has(n.parent_id ?? ''));
  if (roots.length <= 1) return nodes;

  // Resolver clave + etiqueta + color para cada raíz según el modo.
  const projectById = new Map((ctx.projects ?? []).map((p) => [p.id, p]));
  const teamById = new Map((ctx.teams ?? []).map((t) => [t.id, t]));
  const userById = new Map(ctx.users.map((u) => [u.id, u]));

  interface KeyMeta { key: string; label: string; color?: string | null; sortKey: string }
  const keyOfRoot = (root: WbsNode): KeyMeta => {
    if (groupBy === 'responsible') {
      const key = root.responsible_id ?? UNASSIGNED_KEY;
      if (key === UNASSIGNED_KEY) return { key, label: 'Sin responsable', sortKey: '￿' };
      const u = userById.get(key);
      const label = u?.full_name ?? u?.email ?? key;
      return { key, label, sortKey: label };
    }
    // team
    const proj = projectById.get(root.project_id);
    const teamId = proj?.team_id ?? proj?.teams?.id ?? null;
    if (!teamId) return { key: UNASSIGNED_KEY, label: 'Sin equipo', sortKey: '￿' };
    const team = teamById.get(teamId) ?? (proj?.teams ?? null);
    const label = team?.name ?? teamId;
    return { key: teamId, label, color: team?.color ?? null, sortKey: label };
  };

  // Bucketing
  const buckets = new Map<string, { meta: KeyMeta; roots: WbsNode[] }>();
  roots.forEach((root) => {
    const meta = keyOfRoot(root);
    const bucket = buckets.get(meta.key);
    if (bucket) bucket.roots.push(root);
    else buckets.set(meta.key, { meta, roots: [root] });
  });

  if (buckets.size <= 1) return nodes;

  const prefix = groupBy === 'team' ? TEAM_PREFIX : RESP_PREFIX;
  const groupSynthetics: WbsNode[] = [];
  const reparented: WbsNode[] = [];

  const sortedKeys = [...buckets.entries()].sort(([, a], [, b]) =>
    a.meta.sortKey.localeCompare(b.meta.sortKey, 'es', { sensitivity: 'base' }),
  );

  sortedKeys.forEach(([key, { meta, roots: bucketRoots }], idx) => {
    const groupId = `${prefix}${key}`;

    const dates = bucketRoots
      .map((n) => ({ start: n.start_date, end: n.end_date }))
      .filter((d) => d.start || d.end);
    const startDate = dates.reduce<string | null>((min, d) => !d.start ? min : !min || d.start < min ? d.start : min, null);
    const endDate = dates.reduce<string | null>((max, d) => !d.end ? max : !max || d.end > max ? d.end : max, null);
    const progresses = bucketRoots.map((n) => n.progress ?? 0);
    const avgProgress = progresses.length > 0 ? progresses.reduce((a, b) => a + b, 0) / progresses.length : 0;

    groupSynthetics.push({
      id: groupId,
      project_id: groupId,
      parent_id: null,
      name: `${meta.label} · ${bucketRoots.length} ${bucketRoots.length === 1 ? 'proyecto' : 'proyectos'}`,
      type: 'group',
      description: null,
      start_date: startDate,
      end_date: endDate,
      duration_days: null,
      progress: avgProgress,
      estimated_hours: null,
      estimated_cost: null,
      color: meta.color ?? null,
      sort_order: idx,
      responsible_id: groupBy === 'responsible' && key !== UNASSIGNED_KEY ? key : null,
      is_unscheduled: false,
      status: null,
      path: groupId,
    });

    bucketRoots.forEach((root, j) => {
      reparented.push({ ...root, parent_id: groupId, sort_order: j });
    });
  });

  const otherNodes = nodes.filter((n) => !roots.some((r) => r.id === n.id));
  return [...groupSynthetics, ...reparented, ...otherNodes];
}
