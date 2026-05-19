import { useState } from 'react';
import type { Profile, Project, WbsNode } from '../lib/types';
import { validateDateRange } from '../lib/validation';

interface BacklogPanelProps {
  items: WbsNode[];
  projects: Project[];
  users: Profile[];
  open: boolean;
  onToggle: () => void;
  onSelectNode: (node: WbsNode) => void;
  onScheduleNode: (node: WbsNode, dates: { start_date: string; end_date: string | null }) => Promise<void>;
}

export function BacklogPanel({ items, projects, users, open, onToggle, onSelectNode, onScheduleNode }: BacklogPanelProps) {
  if (!open) {
    // V-20: rail más descubrible — botón con icono + etiqueta horizontal en la parte superior
    return (
      <aside className="backlog-rail" aria-label="Backlog colapsado">
        <button
          className="backlog-rail-toggle"
          title={`Abrir backlog (${items.length} tareas sin fecha)`}
          aria-label={`Abrir backlog con ${items.length} tareas sin fecha`}
          onClick={onToggle}
        >
          <span className="backlog-rail-icon" aria-hidden>📥</span>
          {items.length > 0 && <span className="backlog-rail-badge">{items.length}</span>}
        </button>
        <span className="backlog-rail-label">Backlog</span>
      </aside>
    );
  }

  const byProject = groupByProject(items);

  return (
    <aside className="backlog-panel" aria-label="Backlog">
      <header>
        <div>
          <p>Backlog</p>
          <h2>Tareas sin fecha</h2>
        </div>
        <button title="Cerrar backlog" onClick={onToggle}>‹</button>
      </header>
      <div className="backlog-create-hint">Crea un nodo sin fechas para enviarlo automáticamente aquí.</div>
      <div className="backlog-list">
        {items.length === 0 && <p className="empty-backlog">No hay tareas sin programar.</p>}
        {Object.entries(byProject).map(([projectId, nodes]) => {
          const project = projects.find((item) => item.id === projectId);
          return (
            <section key={projectId} className="backlog-group">
              <h3><i />{project?.name ?? 'Proyecto sin nombre'}<span>{nodes.length}</span></h3>
              {nodes.map((node) => <BacklogItem key={node.id} node={node} users={users} onSelectNode={onSelectNode} onScheduleNode={onScheduleNode} />)}
            </section>
          );
        })}
      </div>
    </aside>
  );
}

function BacklogItem({ node, users, onSelectNode, onScheduleNode }: { node: WbsNode; users: Profile[]; onSelectNode: (node: WbsNode) => void; onScheduleNode: BacklogPanelProps['onScheduleNode'] }) {
  const [open, setOpen] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!startDate) {
      setError('Inicio requerido.');
      return;
    }
    const validation = validateDateRange(startDate, endDate || null);
    if (!validation.ok) {
      setError(validation.message ?? 'Fechas inválidas.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onScheduleNode(node, { start_date: startDate, end_date: endDate || null });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo programar.');
    } finally {
      setSaving(false);
    }
  };

  const responsible = node.responsible_id ? users.find((user) => user.id === node.responsible_id) : null;

  return (
    <article className="backlog-card">
      <button className="backlog-item" onClick={() => onSelectNode(node)}>
        <strong>{node.name}</strong>
        <span>{labelForType(node.type)}{responsible ? ` · ${responsible.full_name ?? responsible.email}` : ''}</span>
      </button>
      {open ? (
        <form className="schedule-form" onSubmit={submit}>
          <input aria-label="Inicio" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          <input aria-label="Fin" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          <div>
            <button type="button" onClick={() => setOpen(false)}>Cancelar</button>
            <button type="submit" disabled={saving}>{saving ? '...' : 'Programar'}</button>
          </div>
          {error && <p>{error}</p>}
        </form>
      ) : (
        <button className="schedule-toggle" onClick={() => setOpen(true)}>Programar</button>
      )}
    </article>
  );
}

function groupByProject(items: WbsNode[]) {
  return items.reduce<Record<string, WbsNode[]>>((groups, item) => {
    groups[item.project_id] = groups[item.project_id] ?? [];
    groups[item.project_id].push(item);
    return groups;
  }, {});
}

function labelForType(type: WbsNode['type']) {
  const labels: Record<WbsNode['type'], string> = {
    project: 'Proyecto',
    stage: 'Etapa',
    group: 'Grupo',
    task: 'Tarea',
    milestone: 'Hito',
  };
  return labels[type];
}
