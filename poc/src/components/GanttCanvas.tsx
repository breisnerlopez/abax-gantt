import { useEffect, useRef, useState } from 'react';
import { gantt } from 'dhtmlx-gantt';
import { ConfirmDialog } from './ConfirmDialog';
import { toGanttData } from '../lib/dhtmlx-adapter';
import type { Dependency, DependencyType, Profile, WbsNode } from '../lib/types';
import { canCreateDependency, canMoveNode } from '../lib/validation';

const COLLAPSED_KEY = 'abax.collapsed';

const STATUS_LABELS: Record<string, string> = {
  pendiente: 'Pendiente',
  en_progreso: 'En progreso',
  completado: 'Completado',
  retrasado: 'Retrasado',
  cancelado: 'Cancelado',
  en_pausa: 'En pausa',
  en_revision: 'En revisión',
};

function computeNodeStatus(node: WbsNode): string {
  if (node.status) return node.status;
  const today = new Date().toISOString().slice(0, 10);
  if ((node.progress ?? 0) >= 1) return 'completado';
  if (node.end_date && node.end_date < today) return 'retrasado';
  if ((node.progress ?? 0) > 0) return 'en_progreso';
  return 'pendiente';
}

function loadCollapsed(): Set<string> {
  try {
    const raw = localStorage.getItem(COLLAPSED_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch { return new Set(); }
}

function saveCollapsed(set: Set<string>) {
  try { localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...set])); } catch { /* ignore */ }
}

interface GanttCanvasProps {
  nodes: WbsNode[];
  dependencies: Dependency[];
  users: Profile[];
  onSelectNode: (node: WbsNode | null) => void;
  onCreateDependency: (input: { predecessor_id: string; successor_id: string; type: DependencyType }) => Promise<Dependency | null>;
  onDeleteDependency: (dependencyId: string) => Promise<boolean>;
  onMoveNode: (nodeId: string, input: { parent_id?: string | null; sort_order?: number }) => Promise<boolean>;
  /** Persiste cambios de start/end producidos al arrastrar una barra del Gantt. */
  onUpdateDates?: (nodeId: string, input: { start_date: string; end_date: string }) => Promise<unknown>;
  /** Persiste el cambio de estado al editar la columna inline. */
  onUpdateStatus?: (nodeId: string, status: string | null) => Promise<unknown>;
  canEditStructure: boolean;
  onValidationError: (message: string) => void;
  todaySignal: number;
  scale: 'Día' | 'Semana' | 'Mes' | 'Año';
  onMoveComplete: () => void;
}

export function GanttCanvas({ nodes, dependencies, users, onSelectNode, onCreateDependency, onDeleteDependency, onMoveNode, onUpdateDates, onUpdateStatus, canEditStructure, onValidationError, todaySignal, scale, onMoveComplete }: GanttCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pendingDeleteLinkId, setPendingDeleteLinkId] = useState<string | null>(null);
  const [deletingLink, setDeletingLink] = useState(false);

  // Mantenemos refs vivas con las últimas props para que los handlers que registramos
  // en el useEffect de init no se queden con valores obsoletos.
  const nodesRef = useRef(nodes);
  const dependenciesRef = useRef(dependencies);
  const usersRef = useRef(users);
  const callbacksRef = useRef({ onSelectNode, onCreateDependency, onDeleteDependency, onMoveNode, onUpdateDates, onUpdateStatus, onValidationError, onMoveComplete });
  // Flag para suprimir onAfterTaskUpdate durante un parse/clearAll programático.
  const isParsingRef = useRef(false);
  useEffect(() => {
    nodesRef.current = nodes;
    dependenciesRef.current = dependencies;
    usersRef.current = users;
    callbacksRef.current = { onSelectNode, onCreateDependency, onDeleteDependency, onMoveNode, onUpdateDates, onUpdateStatus, onValidationError, onMoveComplete };
  });

  // Init UNA SOLA VEZ (depende sólo de canEditStructure para reconfigurar permisos).
  // Antes incluíamos `nodes` en deps, lo que disparaba un gantt.init + clearAll cada vez
  // que cambiaban los nodos y dejaba el grid vacío.
  useEffect(() => {
    if (!containerRef.current) return;
    const userByIdGet = () => new Map(usersRef.current.map((user) => [user.id, user]));
    const nodeByIdGet = () => new Map(nodesRef.current.map((node) => [node.id, node]));

    gantt.config.date_format = '%Y-%m-%d';
    gantt.config.duration_unit = 'day';
    gantt.config.row_height = 32;
    gantt.config.scale_height = 56;
    gantt.config.min_column_width = 42;
    gantt.config.fit_tasks = true;
    gantt.config.order_branch = canEditStructure;
    gantt.config.order_branch_free = canEditStructure;
    gantt.config.show_quick_info = true;
    gantt.config.drag_links = canEditStructure;
    gantt.config.show_links = true;
    gantt.config.drag_project = canEditStructure;
    gantt.config.readonly = !canEditStructure;
    gantt.config.details_on_dblclick = false;
    gantt.config.smart_rendering = true;
    gantt.config.min_grid_column_width = 60;

    gantt.config.columns = [
      {
        name: 'text',
        label: 'Nombre',
        tree: true,
        width: 360,
        resize: true,
        template: (task: { text?: string; type?: string }) => `<span class="wbs-glyph wbs-glyph--${task.type ?? 'task'}"></span>${task.text ?? ''}`,
      },
      {
        name: 'start_date',
        label: 'Inicio',
        width: 95,
        align: 'center',
        resize: true,
        template: (task: { start_date?: Date | string | null }) => {
          if (!task.start_date) return '';
          const d = task.start_date instanceof Date ? task.start_date : new Date(task.start_date);
          if (Number.isNaN(d.getTime())) return '';
          const dd = String(d.getDate()).padStart(2, '0');
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          return `${dd}/${mm}/${d.getFullYear()}`;
        },
      },
      { name: 'duration', label: 'Días', width: 48, align: 'center', resize: true },
      {
        name: 'progress',
        label: '%',
        width: 48,
        align: 'center',
        resize: true,
        template: (task: { progress?: number }) => `${Math.round((task.progress ?? 0) * 100)}%`,
      },
      {
        name: 'status',
        label: 'Estado',
        width: 105,
        align: 'center',
        resize: true,
        editor: {
          type: 'select',
          map_to: 'status',
          options: [
            { key: '__auto__', label: 'Auto' },
            ...Object.entries(STATUS_LABELS).map(([key, label]) => ({ key, label })),
          ],
        },
        template: (task: Record<string, unknown>) => {
          const ganttTask = task as { node?: WbsNode };
          if (!ganttTask.node) return '';
          const s = computeNodeStatus(ganttTask.node);
          return `<span class="status-badge status-badge--${s}">${STATUS_LABELS[s] ?? s}</span>`;
        },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      {
        name: 'responsible',
        label: 'Resp.',
        width: 70,
        align: 'center',
        resize: false,
        template: (task) => {
          const ganttTask = task as { node?: WbsNode };
          const responsible = ganttTask.node?.responsible_id ? userByIdGet().get(ganttTask.node.responsible_id) : null;
          return responsible ? `<span class="responsible-badge">${initials(responsible.full_name ?? responsible.email ?? 'U')}</span>` : '';
        },
      },
    ];

    gantt.templates.task_class = (_start, _end, task: { id?: string | number; type?: string; isUnscheduled?: boolean }) => {
      const selected = task.id != null && gantt.isSelectedTask(String(task.id));
      const unscheduledClass = task.isUnscheduled ? ' task-unscheduled' : '';
      return `task-${task.type ?? 'task'}${unscheduledClass}${selected ? ' task-selected' : ''}`;
    };
    gantt.templates.grid_row_class = (_start, _end, task: { id?: string | number; type?: string; isUnscheduled?: boolean }) => {
      const selected = task.id != null && gantt.isSelectedTask(String(task.id));
      const unscheduledClass = task.isUnscheduled ? ' row-unscheduled' : '';
      return `row-${task.type ?? 'task'}${unscheduledClass}${selected ? ' row-selected' : ''}`;
    };
    gantt.templates.task_text = (start, end, task: { text?: string }) => {
      const width = Math.abs(gantt.posFromDate(end) - gantt.posFromDate(start));
      const text = task.text ?? '';
      // Evita etiquetas ilegibles: si la barra no alcanza para el texto, queda limpia.
      if (width < Math.min(220, text.length * 7 + 28)) return '';
      return `<span class="gantt-bar-label">${escapeHtml(text)}</span>`;
    };
    // V-15: tooltip enriquecido con la ruta de ancestros (proyecto › etapa › grupo).
    // Resuelve la ruta dinámicamente desde nodesRef para que refleje cambios.
    gantt.templates.tooltip_text = (_start, _end, task) => {
      const t = task as { id?: string | number; text?: string; type?: string; progress?: number };
      const path = t.id != null ? ancestorPath(String(t.id), nodesRef.current) : '';
      const pathHtml = path ? `<br/><small style="opacity:.75">${path}</small>` : '';
      return `<b>${escapeHtml(t.text ?? '')}</b>${pathHtml}<br/>Tipo: ${t.type ?? 'task'} · Avance: ${Math.round((t.progress ?? 0) * 100)}%`;
    };

    gantt.ext.zoom.init({
      levels: [
        { name: 'Día', scale_height: 56, min_column_width: 28, scales: [{ unit: 'month', step: 1, format: '%F %Y' }, { unit: 'day', step: 1, format: '%d' }] },
        { name: 'Semana', scale_height: 56, min_column_width: 32, scales: [{ unit: 'month', step: 1, format: '%F %Y' }, { unit: 'week', step: 1, format: 'S%W' }] },
        { name: 'Mes', scale_height: 56, min_column_width: 72, scales: [{ unit: 'year', step: 1, format: '%Y' }, { unit: 'month', step: 1, format: '%F' }] },
        { name: 'Año', scale_height: 56, min_column_width: 88, scales: [{ unit: 'year', step: 1, format: '%Y' }, { unit: 'quarter', step: 1, format: (date: Date) => `Q${Math.floor(date.getMonth() / 3) + 1}` }] },
      ],
    });

    // V-15: activar plugin tooltip de DHTMLX para que `gantt.templates.tooltip_text` se renderice on-hover.
    try {
      (gantt as unknown as { plugins?: (p: Record<string, boolean>) => void }).plugins?.({ tooltip: true });
    } catch { /* plugin ya activado */ }
    gantt.init(containerRef.current);
    gantt.setSkin('material');
    gantt.ext.zoom.setLevel(scale);

    const selectEvent = gantt.attachEvent('onTaskSelected', (id) => {
      const selected = nodesRef.current.find((node) => node.id === String(id)) ?? null;
      callbacksRef.current.onSelectNode(selected);
      return true;
    });
    const linkAddEvent = gantt.attachEvent('onAfterLinkAdd', (id, link) => {
      const source = String((link as { source: string | number }).source);
      const target = String((link as { target: string | number }).target);
      const validation = canCreateDependency(source, target, dependenciesRef.current);
      if (!validation.ok) {
        callbacksRef.current.onValidationError(validation.message ?? 'Dependencia inválida.');
        gantt.deleteLink(id);
        return false;
      }
      const dependencyType = linkTypeToDependencyType(String((link as { type?: string }).type ?? '0'));
      void callbacksRef.current.onCreateDependency({
        predecessor_id: source,
        successor_id: target,
        type: dependencyType,
      }).then((created) => {
        if (created) gantt.changeLinkId(id, created.id);
        else gantt.deleteLink(id);
      });
      return true;
    });
    const linkDeleteEvent = gantt.attachEvent('onAfterLinkDelete', (id) => {
      setPendingDeleteLinkId(String(id));
      void Promise.resolve().then(() => gantt.parse(toGanttData(nodesRef.current, dependenciesRef.current)));
      return true;
    });
    // onAfterTaskUpdate: dispara al SOLTAR un drag de fecha/duración (no durante el drag).
    // Persistimos start_date + end_date al backend via scheduleWbsNode. Sin esto, los cambios
    // se pierden en el siguiente refresh del portfolio.
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const updateEvent = gantt.attachEvent('onAfterTaskUpdate', (id, item) => {
      if (isParsingRef.current) return true;
      const taskId = String(id);
      if (!UUID_RE.test(taskId)) return true;
      const node = nodesRef.current.find((n) => n.id === taskId);
      if (!node || node.type === 'project') return true;

      const newStatus = (item as { status?: string }).status;
      if (newStatus !== undefined) {
        const resolved = newStatus === '__auto__' ? null : newStatus;
        const oldComputed = computeNodeStatus(node);
        const newComputed = resolved ?? computeNodeStatus({ ...node, status: null } as WbsNode);
        if (resolved === node.status || (!resolved && !node.status)) { gantt.closeEditor(); return true; }
        if (!resolved && oldComputed === newComputed) { gantt.closeEditor(); return true; }
        node.status = resolved ?? null;
        void callbacksRef.current.onUpdateStatus?.(taskId, resolved).catch(() => {
          gantt.parse(toGanttData(nodesRef.current, dependenciesRef.current));
        });
        gantt.closeEditor();
        return true;
      }
      const startDate = (item as { start_date?: Date | string }).start_date;
      const duration = (item as { duration?: number }).duration ?? 1;
      if (!startDate) return true;
      const start = startDate instanceof Date ? startDate : new Date(startDate);
      if (Number.isNaN(start.getTime())) return true;
      const end = new Date(start.getTime());
      end.setUTCDate(end.getUTCDate() + Math.max(0, duration - 1));
      const startStr = start.toISOString().slice(0, 10);
      const endStr = end.toISOString().slice(0, 10);
      if (startStr === (node.start_date ?? '').slice(0, 10) && endStr === (node.end_date ?? '').slice(0, 10)) {
        return true; // sin cambios reales
      }
      void callbacksRef.current.onUpdateDates?.(taskId, { start_date: startStr, end_date: endStr }).catch(() => {
        // Si falla, recargar el dato original para evitar UI mentirosa.
        gantt.parse(toGanttData(nodesRef.current, dependenciesRef.current));
      });
      return true;
    });

    const moveEvent = gantt.attachEvent('onAfterTaskMove', (id, parent, index) => {
      const nodeById = nodeByIdGet();
      const node = nodeById.get(String(id));
      const parentNode = parent ? nodeById.get(String(parent)) ?? null : null;
      if (node) {
        const validation = canMoveNode(node, parentNode);
        if (!validation.ok) {
          callbacksRef.current.onValidationError(validation.message ?? 'Movimiento inválido.');
          gantt.parse(toGanttData(nodesRef.current, dependenciesRef.current));
          return false;
        }
      }
      void callbacksRef.current.onMoveNode(String(id), { parent_id: parent ? String(parent) : null, sort_order: Number(index) }).then((ok) => {
        if (ok) callbacksRef.current.onMoveComplete();
        else gantt.render();
      });
      return true;
    });

    // Persistir colapsos de proyecto en localStorage
    const collapsedSet = loadCollapsed();
    const collapsedOpen = gantt.attachEvent('onTaskOpened', (id) => {
      collapsedSet.delete(String(id));
      saveCollapsed(collapsedSet);
    });
    const collapsedClosed = gantt.attachEvent('onTaskClosed', (id) => {
      collapsedSet.add(String(id));
      saveCollapsed(collapsedSet);
    });

    return () => {
      gantt.detachEvent(selectEvent);
      gantt.detachEvent(linkAddEvent);
      gantt.detachEvent(linkDeleteEvent);
      gantt.detachEvent(updateEvent);
      gantt.detachEvent(moveEvent);
      gantt.detachEvent(collapsedOpen);
      gantt.detachEvent(collapsedClosed);
      gantt.clearAll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo reinicializar si cambian permisos; scale se maneja en efecto separado
  }, [canEditStructure]);

  useEffect(() => {
    try {
      gantt.ext.zoom.setLevel(scale);
      const collapsed = loadCollapsed();
      const ganttData = toGanttData(nodesRef.current, dependenciesRef.current, collapsed);
      isParsingRef.current = true;
      gantt.parse(ganttData);
      setTimeout(() => { isParsingRef.current = false; }, 0);
      gantt.render();
    } catch { /* gantt no inicializado */ }
  }, [scale]);

  // Cambiar zoom sin reinicializar todo el Gantt: solo ajustar nivel y re-renderizar.

  useEffect(() => {
    if (!containerRef.current) return;
    const collapsed = loadCollapsed();
    const ganttData = toGanttData(nodes, dependencies, collapsed);
    isParsingRef.current = true;
    gantt.clearAll();
    gantt.parse(ganttData);
    // Resetear el flag tras el ciclo de eventos para evitar carrera.
    setTimeout(() => { isParsingRef.current = false; }, 0);
  }, [nodes, dependencies]);

  useEffect(() => {
    if (!todaySignal) return;
    const date = new Date().toISOString().slice(0, 10);
    try { gantt.showDate(new Date(date)); } catch { /* gantt not initialized */ }
  }, [todaySignal]);

  // V-02 fix: re-calculate sizes when the container resizes (detail panel toggling,
  // backlog open/close, filter changes that shrink the gantt area).
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let rafId = 0;
    const observer = new ResizeObserver(() => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        try { gantt.setSizes(); gantt.render(); } catch { /* gantt not initialized */ }
      });
    });
    observer.observe(el);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      const isInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (isInput) return;
      if (e.key === '+' || e.key === '=') { e.preventDefault(); try { gantt.ext.zoom.zoomIn(); } catch { /* noop */ } }
      if (e.key === '-') { e.preventDefault(); try { gantt.ext.zoom.zoomOut(); } catch { /* noop */ } }
      if (e.key === 'ArrowLeft') { e.preventDefault(); try { gantt.ext.zoom.zoomOut(); } catch { /* noop */ } }
      if (e.key === 'ArrowRight') { e.preventDefault(); try { gantt.ext.zoom.zoomIn(); } catch { /* noop */ } }
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);

  const confirmDeleteLink = async () => {
    if (!pendingDeleteLinkId) return;
    setDeletingLink(true);
    try {
      await onDeleteDependency(pendingDeleteLinkId);
    } finally {
      setDeletingLink(false);
      setPendingDeleteLinkId(null);
    }
  };

  return (
    <>
      <div ref={containerRef} className="gantt-canvas" />
      {pendingDeleteLinkId && (
        <ConfirmDialog
          title="Eliminar dependencia"
          description="Se eliminara el enlace entre tareas. Esta accion no se puede deshacer."
          confirmLabel="Eliminar"
          busy={deletingLink}
          onCancel={() => setPendingDeleteLinkId(null)}
          onConfirm={() => void confirmDeleteLink()}
        />
      )}
    </>
  );
}

function initials(name: string) {
  return name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] ?? c));
}

// V-15: construye la ruta legible de ancestros para un nodo dado.
// Recorre parent_id hacia arriba con un Map (O(profundidad)).
function ancestorPath(nodeId: string, all: WbsNode[]): string {
  const byId = new Map(all.map((n) => [n.id, n]));
  const chain: string[] = [];
  let current = byId.get(nodeId);
  let safety = 0;
  while (current?.parent_id && safety < 20) {
    const parent = byId.get(current.parent_id);
    if (!parent) break;
    chain.unshift(parent.name);
    current = parent;
    safety++;
  }
  return chain.map(escapeHtml).join(' › ');
}

function linkTypeToDependencyType(type: string): DependencyType {
  const map: Record<string, DependencyType> = { '0': 'FS', '1': 'SS', '2': 'FF', '3': 'SF' };
  return map[type] ?? 'FS';
}
