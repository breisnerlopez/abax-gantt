import type { Dependency, WbsNode } from './types';

export interface GanttTask {
  id: string;
  text: string;
  start_date: string;
  duration: number;
  progress: number;
  parent: string | 0;
  type: string;
  open: boolean;
  color?: string;
  status?: string;
  node: WbsNode;
  isUnscheduled?: boolean;
}

export interface GanttLink {
  id: string;
  source: string;
  target: string;
  type: string;
}

const DEP_TYPE: Record<string, string> = { FS: '0', SS: '1', FF: '2', SF: '3' };

function durationInDays(start: string | null, end: string | null, fallback: number | null): number {
  if (fallback && fallback > 0) return fallback;
  if (!start || !end) return 1;
  // Evitar `new Date('YYYY-MM-DD')` (UTC) que puede correrse según TZ/DST.
  // Persistimos fechas como YYYY-MM-DD (calendario local), así que calculamos en local.
  const [sy, sm, sd] = start.split('-').map((v) => Number(v));
  const [ey, em, ed] = end.split('-').map((v) => Number(v));
  const startTime = new Date(sy, (sm ?? 1) - 1, sd ?? 1).getTime();
  const endTime = new Date(ey, (em ?? 1) - 1, ed ?? 1).getTime();
  if (Number.isNaN(startTime) || Number.isNaN(endTime)) return 1;
  return Math.max(1, Math.round((endTime - startTime) / 86400000) + 1);
}

function computeNodeStatus(node: WbsNode): string {
  if (node.status) return node.status;
  const today = new Date().toISOString().slice(0, 10);
  if ((node.progress ?? 0) >= 1) return 'completado';
  if (node.end_date && node.end_date < today) return 'retrasado';
  if ((node.progress ?? 0) > 0) return 'en_progreso';
  return 'pendiente';
}

export function toGanttData(nodes: WbsNode[], dependencies: Dependency[], collapsedIds?: Set<string>) {
  const scheduledNodes = nodes.filter((node) => !node.is_unscheduled && (node.start_date || node.type === 'project'));
  const existingIds = new Set(scheduledNodes.map((node) => node.id));

  const data: GanttTask[] = scheduledNodes.map((node) => ({
    id: node.id,
    text: node.name,
    start_date: node.start_date ?? new Date().toISOString().slice(0, 10),
    duration: node.type === 'milestone' ? 0 : durationInDays(node.start_date, node.end_date, node.duration_days),
    progress: Math.max(0, Math.min(1, node.progress ?? 0)),
    parent: node.parent_id && existingIds.has(node.parent_id) ? node.parent_id : 0,
    type: node.type,
    open: collapsedIds ? !collapsedIds.has(node.id) : true,
    color: node.color ?? undefined,
    status: computeNodeStatus(node),
    isUnscheduled: (node as WbsNode & { _from_backlog?: boolean })._from_backlog === true,
    node,
  }));

  const links: GanttLink[] = dependencies
    .filter((dep) => existingIds.has(dep.predecessor_id) && existingIds.has(dep.successor_id))
    .map((dep) => ({
      id: dep.id,
      source: dep.predecessor_id,
      target: dep.successor_id,
      type: DEP_TYPE[dep.type] ?? '0',
    }));

  return { data, links };
}
