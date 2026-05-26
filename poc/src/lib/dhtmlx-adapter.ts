import type { Dependency, WbsNode } from './types';

export interface GanttTask {
  id: string;
  text: string;
  start_date: string | Date;
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
  // Si tenemos start y end, calculamos inclusivo aquí. NO usamos `node.duration_days` de la DB
  // como atajo: ese campo lo genera Postgres como `end_date - start_date` (exclusivo), y DHTMLX
  // espera duration = nº de días que cubre la barra (inclusivo). La inconsistencia provocaba
  // que al ampliar la barra desde la izquierda el extremo derecho retrocediera un día.
  if (start && end) {
    const startTime = parseLocalYmd(start).getTime();
    const endTime = parseLocalYmd(end).getTime();
    if (!Number.isNaN(startTime) && !Number.isNaN(endTime)) {
      return Math.max(1, Math.round((endTime - startTime) / 86400000) + 1);
    }
  }
  if (fallback && Number.isFinite(fallback) && fallback > 0) return Math.round(fallback);
  return 1;
}

function todayLocal(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

// Devuelve SIEMPRE una Date válida en horario local.
// DHTMLX llama internamente `calculateEndDate` sobre cada tarea y lanza
// "Invalid start_date argument for calculateEndDate method" si recibe un Invalid Date.
// Por eso aquí toleramos Date, strings YYYY-MM-DD, ISO con tiempo (YYYY-MM-DDTHH:..)
// y caemos a hoy si nada matchea.
function parseLocalYmd(value: string | Date | null | undefined): Date {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return todayLocal();
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  if (typeof value === 'string') {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    if (m) {
      const y = Number(m[1]);
      const mo = Number(m[2]) - 1;
      const d = Number(m[3]);
      const parsed = new Date(y, mo, d);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    const fallback = new Date(value);
    if (!Number.isNaN(fallback.getTime())) {
      return new Date(fallback.getFullYear(), fallback.getMonth(), fallback.getDate());
    }
  }
  return todayLocal();
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
    // Evita parseo UTC de 'YYYY-MM-DD' en algunos paths (puede mover la barra al día anterior).
    // Damos Date en horario local para que DHTMLX pinte en el día correcto.
    start_date: parseLocalYmd(node.start_date),
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
