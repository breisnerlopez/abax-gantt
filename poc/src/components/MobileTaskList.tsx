import { useMemo, useState } from 'react';
import type { Profile, WbsNode } from '../lib/types';

interface MobileTaskListProps {
  nodes: WbsNode[];
  users: Profile[];
  currentUserId: string | null;
  role: 'admin' | 'responsable' | 'ejecutor';
  onSelectNode: (node: WbsNode | null) => void;
  onReportProgress: (nodeId: string, input: { progress: number; hours?: number | null }) => Promise<void>;
  onShowGantt: () => void;
}

type Section = 'atrasadas' | 'hoy' | 'semana';

function ymd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function classifyTask(endDate: string | null, progress: number, todayStr: string, weekStr: string): Section | null {
  if (!endDate || progress >= 1) return null;
  const end = endDate.slice(0, 10);
  if (end < todayStr) return 'atrasadas';
  if (end === todayStr) return 'hoy';
  if (end <= weekStr) return 'semana';
  return null;
}

function ancestorPath(nodeId: string, all: WbsNode[]): string {
  const byId = new Map(all.map((n) => [n.id, n]));
  const chain: string[] = [];
  let cur = byId.get(nodeId);
  let safety = 0;
  while (cur?.parent_id && safety < 10) {
    const parent = byId.get(cur.parent_id);
    if (!parent) break;
    chain.unshift(parent.name);
    cur = parent;
    safety++;
  }
  return chain.join(' › ');
}

function daysUntil(target: string, today: Date): number {
  const t = new Date(target.slice(0, 10) + 'T00:00:00Z');
  const diff = Math.round((t.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
}

interface TaskCardProps {
  node: WbsNode;
  pathLabel: string;
  responsibleName: string | null;
  daysLabel: string;
  daysTone: 'danger' | 'warning' | 'muted';
  onOpen: () => void;
  onChangeProgress: (value: number) => Promise<void>;
  onAddHours: (hours: number) => Promise<void>;
}

function TaskCard({ node, pathLabel, responsibleName, daysLabel, daysTone, onOpen, onChangeProgress, onAddHours }: TaskCardProps) {
  const [progress, setProgress] = useState(Math.round((node.progress ?? 0) * 100));
  const [saving, setSaving] = useState(false);
  const [hoursInputOpen, setHoursInputOpen] = useState(false);
  const [hoursValue, setHoursValue] = useState('');

  const handleProgressCommit = async (value: number) => {
    if (saving) return;
    setSaving(true);
    try { await onChangeProgress(value / 100); }
    finally { setSaving(false); }
  };

  const handleHoursSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const h = parseFloat(hoursValue);
    if (!h || h <= 0) return;
    setSaving(true);
    try {
      await onAddHours(h);
      setHoursValue('');
      setHoursInputOpen(false);
    } finally { setSaving(false); }
  };

  return (
    <article className="mtask-card">
      <div className="mtask-head" onClick={onOpen} role="button">
        <span className={`mtask-glyph mtask-glyph--${node.type}`} />
        <div className="mtask-titles">
          <b>{node.name}</b>
          {pathLabel && <small>{pathLabel}</small>}
        </div>
        <span className={`mtask-days mtask-days--${daysTone}`}>{daysLabel}</span>
      </div>
      <div className="mtask-meta">
        {responsibleName && <span className="mtask-resp">{responsibleName}</span>}
        <span className="mtask-progress-value">{progress}%</span>
      </div>
      <div className="mtask-actions" onClick={(e) => e.stopPropagation()}>
        <input
          className="mtask-slider"
          type="range"
          min={0}
          max={100}
          step={5}
          value={progress}
          disabled={saving}
          onChange={(e) => setProgress(parseInt(e.target.value, 10))}
          onMouseUp={(e) => void handleProgressCommit(parseInt((e.target as HTMLInputElement).value, 10))}
          onTouchEnd={(e) => void handleProgressCommit(parseInt((e.target as HTMLInputElement).value, 10))}
          aria-label={`Avance de ${node.name}`}
        />
        {hoursInputOpen ? (
          <form className="mtask-hours-form" onSubmit={handleHoursSubmit}>
            <input
              type="number"
              step="0.25"
              min="0.25"
              autoFocus
              placeholder="Horas"
              value={hoursValue}
              onChange={(e) => setHoursValue(e.target.value)}
            />
            <button type="submit" disabled={saving || !hoursValue}>OK</button>
            <button type="button" onClick={() => { setHoursInputOpen(false); setHoursValue(''); }}>✕</button>
          </form>
        ) : (
          <button className="mtask-hours-btn" onClick={() => setHoursInputOpen(true)} disabled={saving}>
            + horas
          </button>
        )}
      </div>
    </article>
  );
}

export function MobileTaskList({ nodes, users, currentUserId, role, onSelectNode, onReportProgress, onShowGantt }: MobileTaskListProps) {
  const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  const { atrasadas, hoy, semana } = useMemo(() => {
    const todayDate = new Date();
    todayDate.setUTCHours(0, 0, 0, 0);
    const weekDate = new Date(todayDate);
    weekDate.setUTCDate(weekDate.getUTCDate() + 7);
    const todayStr = ymd(todayDate);
    const weekStr = ymd(weekDate);

    const groups: Record<Section, WbsNode[]> = { atrasadas: [], hoy: [], semana: [] };

    // Filtrado por rol implícito
    const visible = nodes.filter((n) => {
      if (n.type !== 'task') return false;
      if (role === 'admin') return true;
      if (role === 'ejecutor') {
        // Ejecutor: sólo tareas donde es asignado
        return n.task_assignees?.some((a) => a.user_id === currentUserId);
      }
      // Responsable: tareas que administra (responsable directo o ancestro)
      if (!currentUserId) return false;
      if (n.responsible_id === currentUserId) return true;
      // Ancestro responsable
      const byId = new Map(nodes.map((x) => [x.id, x]));
      let cur: WbsNode | undefined = n;
      let safety = 0;
      while (cur?.parent_id && safety < 10) {
        const p = byId.get(cur.parent_id);
        if (!p) break;
        if (p.responsible_id === currentUserId) return true;
        cur = p;
        safety++;
      }
      return false;
    });

    for (const n of visible) {
      const section = classifyTask(n.end_date, n.progress ?? 0, todayStr, weekStr);
      if (section) groups[section].push(n);
    }
    // Ordenar por end_date ascendente
    for (const k of ['atrasadas', 'hoy', 'semana'] as const) {
      groups[k].sort((a, b) => (a.end_date ?? '').localeCompare(b.end_date ?? ''));
    }
    return groups;
  }, [nodes, role, currentUserId]);

  const todayDate = useMemo(() => {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }, []);

  const total = atrasadas.length + hoy.length + semana.length;

  const renderCard = (n: WbsNode) => {
    const responsibleId = n.responsible_id ?? n.task_assignees?.[0]?.user_id ?? null;
    const responsibleProfile = responsibleId ? userById.get(responsibleId) : null;
    const responsibleName = responsibleProfile?.full_name ?? responsibleProfile?.email ?? null;
    const pathLabel = ancestorPath(n.id, nodes);
    const days = n.end_date ? daysUntil(n.end_date, todayDate) : 0;
    const [label, tone] = ((): [string, 'danger' | 'warning' | 'muted'] => {
      if (days < 0) return [`${Math.abs(days)} día${Math.abs(days) === 1 ? '' : 's'} de retraso`, 'danger'];
      if (days === 0) return ['Hoy', 'warning'];
      if (days === 1) return ['Mañana', 'warning'];
      return [`En ${days} días`, 'muted'];
    })();
    return (
      <TaskCard
        key={n.id}
        node={n}
        pathLabel={pathLabel}
        responsibleName={responsibleName}
        daysLabel={label}
        daysTone={tone}
        onOpen={() => onSelectNode(n)}
        onChangeProgress={(value) => onReportProgress(n.id, { progress: value })}
        onAddHours={(hours) => onReportProgress(n.id, { progress: (n.progress ?? 0), hours })}
      />
    );
  };

  return (
    <main className="mobile-tasks">
      <div className="mobile-tasks-header">
        <div>
          <p>Tu agenda</p>
          <h2>{total > 0 ? `${total} ${total === 1 ? 'tarea' : 'tareas'} próximas` : 'Sin pendientes inmediatos'}</h2>
        </div>
        <button className="mobile-show-gantt" onClick={onShowGantt} aria-label="Cambiar a vista Gantt">
          Ver Gantt
        </button>
      </div>

      {total === 0 && (
        <div className="mtask-empty">
          <p>No tienes tareas vencidas ni próximas en los próximos 7 días.</p>
          <button onClick={onShowGantt}>Ver Gantt completo</button>
        </div>
      )}

      {atrasadas.length > 0 && (
        <section className="mtask-section mtask-section--danger">
          <h3>Atrasadas <span>{atrasadas.length}</span></h3>
          {atrasadas.map(renderCard)}
        </section>
      )}
      {hoy.length > 0 && (
        <section className="mtask-section mtask-section--warning">
          <h3>Hoy <span>{hoy.length}</span></h3>
          {hoy.map(renderCard)}
        </section>
      )}
      {semana.length > 0 && (
        <section className="mtask-section">
          <h3>Esta semana <span>{semana.length}</span></h3>
          {semana.map(renderCard)}
        </section>
      )}
    </main>
  );
}
