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
    // Snap de drag/resize a días completos.
    // Sin esto, DHTMLX permite mover a fracciones de día (dependiendo del zoom y del timezone).
    gantt.config.round_dnd_dates = true;
    gantt.config.time_step = 1440;
    gantt.config.row_height = 32;
    gantt.config.scale_height = 56;
    gantt.config.min_column_width = 42;
    gantt.config.fit_tasks = true;
    gantt.config.order_branch = canEditStructure;
    gantt.config.order_branch_free = canEditStructure;
    gantt.config.show_quick_info = true;
    gantt.config.drag_links = canEditStructure;
    gantt.config.show_links = true;
    // Las fechas de los contenedores (project/stage/group) son derivadas por el backend
    // (rollup MIN/MAX de hijos). No permitir drag horizontal del summary bar.
    gantt.config.drag_project = false;
    gantt.config.drag_resize = canEditStructure;
    gantt.config.drag_move = canEditStructure;
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
          const d = task.start_date instanceof Date
            ? task.start_date
            : parseLocalYmdMaybe(task.start_date);
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

    // Las fechas de project/stage/group son derivadas (MIN/MAX de hijos) en el backend.
    // Bloqueamos cualquier intento de moverlas/resizearlas desde el timeline.
    const beforeDragEvent = gantt.attachEvent('onBeforeTaskDrag', (id, mode) => {
      if (mode !== 'move' && mode !== 'resize') return true;
      const task = gantt.getTask(id) as { type?: string };
      if (task?.type === 'project' || task?.type === 'stage' || task?.type === 'group') {
        return false;
      }
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

    const coerceDate = (value: unknown): Date | null => {
      if (!value) return null;
      if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
      if (typeof value === 'string') {
        const d = parseLocalYmdMaybe(value);
        return Number.isNaN(d.getTime()) ? null : d;
      }
      if (typeof value === 'number') {
        const d = new Date(value);
        return Number.isNaN(d.getTime()) ? null : d;
      }
      return null;
    };

    const persistDatesFromItem = (taskId: string, item: unknown) => {
      const node = nodesRef.current.find((n) => n.id === taskId);
      if (!node || node.type === 'project') return;

      const startDate = (item as { start_date?: unknown }).start_date;
      const duration = Math.max(1, Math.round((item as { duration?: number }).duration ?? 1));
      const start = coerceDate(startDate);
      if (!start) return;

      // Persistimos calendario por día (inclusive). Evitamos `gantt.calculateEndDate` aquí:
      // puede tirar "Invalid start_date argument" si start_date viene en formato inesperado.
      const end = new Date(start.getTime());
      end.setDate(end.getDate() + duration - 1);
      // Persistimos en YYYY-MM-DD usando calendario local, no UTC.
      // Usar toISOString() desplaza el día en TZ != UTC.
      const startStr = formatLocalYmd(start);
      const endStr = formatLocalYmd(end);
      if (startStr === (node.start_date ?? '').slice(0, 10) && endStr === (node.end_date ?? '').slice(0, 10)) return;
      void callbacksRef.current.onUpdateDates?.(taskId, { start_date: startStr, end_date: endStr }).catch(() => {
        gantt.parse(toGanttData(nodesRef.current, dependenciesRef.current));
      });
    };

    const updateEvent = gantt.attachEvent('onAfterTaskUpdate', (id, item) => {
      if (isParsingRef.current) return true;
      const taskId = String(id);
      if (!UUID_RE.test(taskId)) return true;
      const node = nodesRef.current.find((n) => n.id === taskId);
      if (!node || node.type === 'project') return true;

      // Si hay cambios de fechas, priorizar persistir fechas.
      // Nota: `status` suele existir siempre (lo seteamos en la data), incluso cuando
      // el update viene de drag/resize. Por eso NO podemos usar `status !== undefined`
      // como señal exclusiva de "edición de estado".
      const startDate = (item as { start_date?: Date | string }).start_date;
      const duration = Math.max(1, Math.round((item as { duration?: number }).duration ?? 1));
      const start = startDate ? coerceDate(startDate) : null;
      const end = start && !Number.isNaN(start.getTime())
        ? (() => {
          const inclusive = new Date(start.getTime());
          inclusive.setDate(inclusive.getDate() + duration - 1);
          return inclusive;
        })()
        : null;
      const startStr = start ? formatLocalYmd(start) : null;
      const endStr = end ? formatLocalYmd(end) : null;
      const datesChanged = !!(startStr && endStr) && (
        startStr !== (node.start_date ?? '').slice(0, 10) ||
        endStr !== (node.end_date ?? '').slice(0, 10)
      );
      if (datesChanged) {
        persistDatesFromItem(taskId, item);
        return true;
      }

      // Si no hay cambio de fechas, entonces sí tratamos el cambio de estado.
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

      return true;
    });

    // Hay casos (segun config/plugins) donde el resize/move no dispara onAfterTaskUpdate.
    // Escuchamos también onAfterTaskDrag para asegurar persistencia.
    const dragEvent = gantt.attachEvent('onAfterTaskDrag', (id, mode, item) => {
      if (isParsingRef.current) return true;
      if (mode !== 'move' && mode !== 'resize') return true;
      const taskId = String(id);
      if (!UUID_RE.test(taskId)) return true;
      persistDatesFromItem(taskId, item);
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
      gantt.detachEvent(beforeDragEvent);
      gantt.detachEvent(linkAddEvent);
      gantt.detachEvent(linkDeleteEvent);
      gantt.detachEvent(updateEvent);
      gantt.detachEvent(dragEvent);
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

  // Snapshot de la última estructura cargada al Gantt, para decidir si podemos
  // hacer un update incremental (rápido, sólo refrescar tareas existentes) o si
  // hace falta el clearAll+parse completo (cuando cambia la topología).
  const lastTopologyRef = useRef<{ ids: Set<string>; parents: Map<string, string | 0>; linkIds: Set<string> } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const collapsed = loadCollapsed();
    const ganttData = toGanttData(nodes, dependencies, collapsed);

    const newIds = new Set(ganttData.data.map((t) => t.id));
    const newParents = new Map(ganttData.data.map((t) => [t.id, t.parent]));
    const newLinkIds = new Set(ganttData.links.map((l) => l.id));

    const sameSet = (a: Set<string>, b: Set<string>): boolean => {
      if (a.size !== b.size) return false;
      for (const v of a) if (!b.has(v)) return false;
      return true;
    };
    const sameParents = (a: Map<string, string | 0>, b: Map<string, string | 0>): boolean => {
      if (a.size !== b.size) return false;
      for (const [k, v] of a) if (b.get(k) !== v) return false;
      return true;
    };

    const canIncremental = !!lastTopologyRef.current
      && sameSet(lastTopologyRef.current.ids, newIds)
      && sameParents(lastTopologyRef.current.parents, newParents)
      && sameSet(lastTopologyRef.current.linkIds, newLinkIds);

    isParsingRef.current = true;
    if (canIncremental) {
      // Update incremental: solo refrescamos campos visibles de tareas existentes.
      // Mucho mas barato que clearAll+parse cuando solo cambiaron fechas / status / progress.
      //
      // Importante: seteamos `end_date` explicitamente (formato EXCLUSIVO que espera
      // DHTMLX, = start + duration). Si solo actualizamos start+duration, DHTMLX
      // suele dejar el end_date interno stale → la barra del PADRE no se ensancha
      // cuando una hija extiende su fecha de fin.
      for (const task of ganttData.data) {
        if (!gantt.isTaskExists(task.id)) continue;
        const existing = gantt.getTask(task.id) as Record<string, unknown>;
        const startDate = task.start_date instanceof Date ? task.start_date : new Date(task.start_date);
        existing.start_date = startDate;
        existing.duration = task.duration;
        if (task.duration > 0) {
          const endDate = new Date(startDate.getTime());
          endDate.setDate(endDate.getDate() + task.duration);
          existing.end_date = endDate;
        } else {
          // Milestone (duration=0): end == start.
          existing.end_date = startDate;
        }
        existing.progress = task.progress;
        existing.text = task.text;
        existing.color = task.color;
        existing.status = task.status;
        existing.node = task.node;
        existing.isUnscheduled = task.isUnscheduled;
        try { gantt.updateTask(task.id); } catch { /* ignore */ }
      }
      gantt.render();
    } else {
      gantt.clearAll();
      gantt.parse(ganttData);
    }

    lastTopologyRef.current = { ids: newIds, parents: newParents, linkIds: newLinkIds };
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
    // Solo capturamos atajos cuando el foco esta DENTRO del canvas del Gantt
    // (o en el body sin foco activo). De lo contrario, escribir "-" en un input
    // de FilterBar/AppShell disparaba zoom. Tambien ignoramos modificadores
    // (Ctrl/Meta/Alt) para no chocar con shortcuts del navegador.
    const isEditableTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
      if (target.isContentEditable) return true;
      const role = target.getAttribute('role');
      if (role === 'textbox' || role === 'combobox' || role === 'searchbox') return true;
      return false;
    };
    const focusInsideGantt = (target: EventTarget | null): boolean => {
      const container = containerRef.current;
      if (!container) return false;
      if (target === container) return true;
      if (target instanceof Node && container.contains(target)) return true;
      return target === document.body || target === null;
    };

    const listener = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isEditableTarget(e.target)) return;
      if (!focusInsideGantt(e.target)) return;

      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        try { gantt.ext.zoom.zoomIn(); } catch { /* noop */ }
      } else if (e.key === '-') {
        e.preventDefault();
        try { gantt.ext.zoom.zoomOut(); } catch { /* noop */ }
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        // Pan temporal: mueve el viewport una unidad de la escala visible.
        // Alineado con la doc de ShortcutsModal ("Avanzar/Retroceder en el tiempo").
        e.preventDefault();
        try {
          const range = gantt.getState().scale_unit || 'day';
          const stepDays = range === 'year' ? 90 : range === 'month' ? 30 : range === 'week' ? 7 : 1;
          const visible = gantt.getState();
          const center = new Date(((visible.min_date as Date).getTime() + (visible.max_date as Date).getTime()) / 2);
          center.setDate(center.getDate() + (e.key === 'ArrowRight' ? stepDays : -stepDays));
          gantt.showDate(center);
        } catch { /* noop */ }
      }
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

function formatLocalYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseLocalYmdMaybe(value: string): Date {
  // Si viene como YYYY-MM-DD (o ISO con T), lo interpretamos en calendario local.
  // `new Date('YYYY-MM-DD')` se interpreta como UTC y puede mostrar el día anterior.
  // Tolera también timestamps tipo `2026-05-26T00:00:00Z` que llegaron desde el
  // backend en algunos paths y disparaban Invalid Date al hacer split('-').
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  return new Date(value);
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
