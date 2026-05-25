import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { AppShell } from '../components/AppShell';
import { BacklogPanel } from '../components/BacklogPanel';
import { CreateDialog } from '../components/CreateDialog';
import { DetailPanel } from '../components/DetailPanel';
import { DetailRail } from '../components/DetailRail';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { FilterBar } from '../components/FilterBar';
import { GanttSkeleton } from '../components/GanttSkeleton';
import { MobileTaskList } from '../components/MobileTaskList';
import { Toolbar } from '../components/Toolbar';
import { errorMessage, useToast } from '../lib/toast';
import { usePortfolio } from '../hooks/usePortfolio';
import { addAssignee, apiUrl, createDependency, createProject, createWbsNode, deleteDependency, listAssignees, moveWbsNode, removeAssignee, reportProgress, scheduleWbsNode, unscheduleWbsNode, updateWbsNode } from '../lib/api';
import type { AuthSession, DependencyType, NodeType, TaskAssignee, WbsNode } from '../lib/types';

const FILTERS_KEY = 'abax.filters';
const SCALE_KEY = 'abax.gantt.scale';

function readScale(searchParams: URLSearchParams): 'Día' | 'Semana' | 'Mes' | 'Año' {
  const raw = searchParams.get('scale');
  if (raw === 'Día' || raw === 'Semana' || raw === 'Mes' || raw === 'Año') return raw;
  try {
    const saved = window.localStorage.getItem(SCALE_KEY);
    if (saved === 'Día' || saved === 'Semana' || saved === 'Mes' || saved === 'Año') return saved;
  } catch { /* ignore */ }
  return 'Semana';
}

function readFilter(key: string): string {
  try {
    const raw = localStorage.getItem(FILTERS_KEY);
    if (!raw) return '';
    return (JSON.parse(raw) as Record<string, string>)[key] ?? '';
  } catch { return ''; }
}

function saveFilters(values: Record<string, string>) {
  try { localStorage.setItem(FILTERS_KEY, JSON.stringify(values)); } catch { /* ignore */ }
}

function clearAllLocalState() {
  try {
    localStorage.removeItem('abax.filters');
    localStorage.removeItem('abax.collapsed');
    localStorage.removeItem('abax.detail.visible');
  } catch { /* ignore */ }
}

const GanttCanvas = lazy(() => import('../components/GanttCanvas').then((module) => ({ default: module.GanttCanvas })));

interface GanttPageProps {
  session: AuthSession | null;
  selectedNode: WbsNode | null;
  onSelectNode: (node: WbsNode | null) => void;
  onLogout: () => Promise<void> | void;
}

export function GanttPage({ session, selectedNode, onSelectNode, onLogout }: GanttPageProps) {
  const token = session?.accessToken ?? null;
  const role = session?.role ?? 'ejecutor';
  const canEditStructure = role !== 'ejecutor';
  const canReportProgress = Boolean(session);
  const { notify } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [createMode, setCreateMode] = useState<'project' | 'child' | null>(null);
  const [backlogOpen, setBacklogOpen] = useState(false);
  const [assignees, setAssignees] = useState<TaskAssignee[]>([]);
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('q') ?? readFilter('q'));
  const [typeFilter, setTypeFilter] = useState<NodeType | null>(() => (searchParams.get('type') as NodeType) || readFilter('type') as NodeType || null);
  const [showUnscheduled, setShowUnscheduled] = useState(() => searchParams.get('unscheduled') === '1');
  const [showBacklogInGantt, setShowBacklogInGantt] = useState(() => searchParams.get('backlog_gantt') !== 'false');
  const [myTasks, setMyTasks] = useState(() => searchParams.get('my') === '1');
  const [focusProjectId, setFocusProjectId] = useState<string | null>(() => searchParams.get('focus') || readFilter('focus') || null);
  const [projectFilter, setProjectFilter] = useState<string | null>(() => searchParams.get('project_id') || readFilter('project_id') || null);
  const [responsibleFilter, setResponsibleFilter] = useState<string | null>(() => searchParams.get('responsible_id') || readFilter('responsible_id') || null);
  const [assigneeFilter, setAssigneeFilter] = useState<string | null>(() => searchParams.get('assignee_id') || readFilter('assignee_id') || null);
  const [statusFilter, setStatusFilter] = useState<string | null>(() => searchParams.get('status') || readFilter('status') || null);
  const [dateFrom, setDateFrom] = useState(() => searchParams.get('date_from') ?? readFilter('date_from'));
  const [dateTo, setDateTo] = useState(() => searchParams.get('date_to') ?? readFilter('date_to'));
  const [activeOnly, setActiveOnly] = useState(() => searchParams.get('active_only') !== 'false');
  const [todaySignal, setTodaySignal] = useState(0);
  const [ganttScale, setGanttScale] = useState<'Día' | 'Semana' | 'Mes' | 'Año'>(() => readScale(searchParams));
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    try { window.localStorage.setItem(SCALE_KEY, ganttScale); } catch { /* ignore */ }
  }, [ganttScale]);

  useEffect(() => {
    saveFilters({ q: searchTerm, type: typeFilter ?? '', unscheduled: showUnscheduled ? '1' : '', my: myTasks ? '1' : '', focus: focusProjectId ?? '', project_id: projectFilter ?? '', responsible_id: responsibleFilter ?? '', assignee_id: assigneeFilter ?? '', status: statusFilter ?? '', date_from: dateFrom, date_to: dateTo, active_only: activeOnly ? '1' : '', backlog_gantt: showBacklogInGantt ? '1' : '' });
  }, [searchTerm, typeFilter, showUnscheduled, myTasks, focusProjectId, projectFilter, responsibleFilter, assigneeFilter, statusFilter, dateFrom, dateTo, activeOnly, showBacklogInGantt]);

  // Panel de detalle on-demand: el usuario lo abre/cierra explícitamente.
  // Default cerrado para mantener el Gantt con máximo ancho.
  const [detailVisible, setDetailVisible] = useState<boolean>(() => {
    try { return window.localStorage.getItem('abax.detail.visible') === '1'; } catch { return false; }
  });
  useEffect(() => {
    try { window.localStorage.setItem('abax.detail.visible', detailVisible ? '1' : '0'); } catch { /* ignore */ }
  }, [detailVisible]);
  const toggleDetail = useCallback(() => setDetailVisible((v) => !v), []);

  // Vista mobile: lista por defecto en <768px, con override del usuario para forzar Gantt.
  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false,
  );
  const [mobileForceGantt, setMobileForceGantt] = useState<boolean>(() => {
    try { return window.localStorage.getItem('abax.mobile.gantt') === '1'; } catch { return false; }
  });
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const showMobileList = isMobile && !mobileForceGantt;
  const toggleMobileMode = useCallback((forceGantt: boolean) => {
    setMobileForceGantt(forceGantt);
    try { window.localStorage.setItem('abax.mobile.gantt', forceGantt ? '1' : '0'); } catch { /* ignore */ }
  }, []);

  const portfolioFilters = useMemo(() => ({
    project_id: focusProjectId ?? projectFilter ?? null,
    search: searchTerm || null,
    my_tasks: myTasks || undefined,
    unscheduled: showUnscheduled,
    responsible_id: responsibleFilter ?? null,
    assignee_id: assigneeFilter ?? null,
    status: statusFilter ?? null,
    date_from: dateFrom || null,
    date_to: dateTo || null,
    active_only: activeOnly || undefined,
  }), [focusProjectId, projectFilter, searchTerm, myTasks, showUnscheduled, responsibleFilter, assigneeFilter, statusFilter, dateFrom, dateTo, activeOnly]);

  const portfolio = usePortfolio(token, portfolioFilters);

  useEffect(() => {
    if (!token || !selectedNode) return;
    let cancelled = false;
    listAssignees(token, selectedNode.id)
      .then((items) => { if (!cancelled) setAssignees(items); })
      .catch(() => { if (!cancelled) setAssignees([]); });
    return () => { cancelled = true; };
  }, [selectedNode, token]);

  const handleUpdateNode = useCallback(async (id: string, patch: Parameters<typeof updateWbsNode>[2]) => {
    if (!token) return;
    try {
      const updated = await updateWbsNode(token, id, patch);
      portfolio.updateNodeLocal(updated);
      onSelectNode(updated);
      notify({ tone: 'success', title: 'Nodo guardado' });
    } catch (error) {
      notify({ tone: 'error', title: 'No se pudo guardar', detail: errorMessage(error) });
      throw error;
    }
  }, [notify, onSelectNode, portfolio, token]);

  const handleScheduleNode = useCallback(async (node: WbsNode, dates: { start_date: string; end_date: string | null }) => {
    if (!token) return;
    try {
      const updated = await scheduleWbsNode(token, node.id, dates);
      const data = await portfolio.refetch();
      onSelectNode(data?.nodes.find((item) => item.id === updated.id) ?? updated);
      notify({ tone: 'success', title: 'Tarea programada' });
    } catch (error) {
      notify({ tone: 'error', title: 'No se pudo programar', detail: errorMessage(error) });
      throw error;
    }
  }, [notify, onSelectNode, portfolio, token]);

  const handleUnscheduleNode = useCallback(async (node: WbsNode) => {
    if (!token) return;
    try {
      const updated = await unscheduleWbsNode(token, node.id);
      const data = await portfolio.refetch();
      onSelectNode(data?.backlog.find((item) => item.id === updated.id) ?? updated);
      setBacklogOpen(true);
      notify({ tone: 'success', title: 'Enviado al backlog' });
    } catch (error) {
      notify({ tone: 'error', title: 'No se pudo enviar al backlog', detail: errorMessage(error) });
    }
  }, [notify, onSelectNode, portfolio, token]);

  const handleAddAssignee = useCallback(async (userId: string) => {
    if (!token || !selectedNode) return;
    try {
      await addAssignee(token, selectedNode.id, userId);
      setAssignees(await listAssignees(token, selectedNode.id));
      await portfolio.refetch();
      notify({ tone: 'success', title: 'Ejecutor asignado' });
    } catch (error) {
      notify({ tone: 'error', title: 'No se pudo asignar ejecutor', detail: errorMessage(error) });
    }
  }, [notify, portfolio, selectedNode, token]);

  const handleRemoveAssignee = useCallback(async (assignmentId: string) => {
    if (!token || !selectedNode) return;
    try {
      await removeAssignee(token, assignmentId);
      setAssignees(await listAssignees(token, selectedNode.id));
      await portfolio.refetch();
      notify({ tone: 'success', title: 'Ejecutor removido' });
    } catch (error) {
      notify({ tone: 'error', title: 'No se pudo quitar ejecutor', detail: errorMessage(error) });
    }
  }, [notify, portfolio, selectedNode, token]);

  const handleReportProgress = useCallback(async (progress: number, hours: number | null) => {
    if (!token || !selectedNode) return;
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(selectedNode.id)) {
      notify({ tone: 'error', title: 'Selección inválida', detail: 'Vuelve a seleccionar el nodo en el árbol.' });
      return;
    }
    portfolio.updateNodeLocal({ ...selectedNode, progress });
    try {
      const result = await reportProgress(token, selectedNode.id, { progress, hours });
      portfolio.updateNodeLocal(result.node);
      onSelectNode(result.node);
      notify({ tone: 'success', title: hours ? 'Avance y horas guardados' : 'Avance guardado' });
    } catch (error) {
      portfolio.updateNodeLocal(selectedNode);
      notify({ tone: 'error', title: 'No se pudo reportar avance', detail: errorMessage(error) });
    }
  }, [notify, onSelectNode, portfolio, selectedNode, token]);

  const handleSetResponsible = useCallback(async (userId: string | null) => {
    if (!token || !selectedNode) return;
    try {
      const updated = await updateWbsNode(token, selectedNode.id, { responsible_id: userId });
      portfolio.updateNodeLocal(updated);
      onSelectNode(updated);
      notify({ tone: 'success', title: 'Responsable actualizado' });
    } catch (error) {
      notify({ tone: 'error', title: 'No se pudo actualizar responsable', detail: errorMessage(error) });
    }
  }, [notify, onSelectNode, portfolio, selectedNode, token]);

  const handleCreateDependency = useCallback(async (input: { predecessor_id: string; successor_id: string; type: DependencyType }) => {
    if (!token) return null;
    try {
      const dependency = await createDependency(token, input);
      portfolio.addDependencyLocal(dependency);
      notify({ tone: 'success', title: 'Dependencia creada' });
      return dependency;
    } catch {
      await portfolio.refetch();
      notify({ tone: 'error', title: 'No se pudo crear dependencia' });
      return null;
    }
  }, [notify, portfolio, token]);

  const handleDeleteDependency = useCallback(async (dependencyId: string) => {
    if (!token) return false;
    try {
      await deleteDependency(token, dependencyId);
      portfolio.removeDependencyLocal(dependencyId);
      notify({ tone: 'success', title: 'Dependencia eliminada' });
      return true;
    } catch {
      await portfolio.refetch();
      notify({ tone: 'error', title: 'No se pudo eliminar dependencia' });
      return false;
    }
  }, [notify, portfolio, token]);

  const handleMoveNode = useCallback(async (nodeId: string, input: { parent_id?: string | null; sort_order?: number }) => {
    if (!token) return false;
    try {
      const updated = await moveWbsNode(token, nodeId, input);
      portfolio.updateNodeLocal(updated);
      notify({ tone: 'success', title: 'Nodo movido' });
      return true;
    } catch {
      await portfolio.refetch();
      notify({ tone: 'error', title: 'Dependencia violada', detail: 'El backend detectó un conflicto con esta operación.' });
      return false;
    }
  }, [notify, portfolio, token]);

  useEffect(() => {
    if (selectedNode) sessionStorage.setItem('abax.gantt.lastNodeId', selectedNode.id);
  }, [selectedNode]);

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      const isInput = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement;
      if (isInput && event.key !== 'Escape') return;
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === 'N') { event.preventDefault(); setCreateMode('project'); return; }
      if ((event.metaKey || event.ctrlKey) && !event.shiftKey && event.key === 'k') { event.preventDefault(); setBacklogOpen((prev) => !prev); return; }
      if ((event.metaKey || event.ctrlKey) && event.key === 'Backspace') { event.preventDefault(); if (selectedNode && canEditStructure && !selectedNode.is_unscheduled && selectedNode.type !== 'project') void handleUnscheduleNode(selectedNode); return; }
      if (event.key === 'Escape') { setCreateMode(null); setBacklogOpen(false); }
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [canEditStructure, handleUnscheduleNode, selectedNode]);

  const sessionEmail = session?.userEmail ?? null;
  const sessionName = session?.userName ?? null;
  const portfolioUsers = portfolio.data?.users;
  const currentUserId = useMemo(() => {
    const users = portfolioUsers ?? [];
    const email = sessionEmail?.toLowerCase() ?? null;
    if (email) {
      const byEmail = users.find((u) => (u.email ?? '').toLowerCase() === email);
      if (byEmail) return byEmail.id;
    }
    if (sessionName) {
      const byName = users.find((u) => u.full_name === sessionName);
      if (byName) return byName.id;
    }
    return null;
  }, [portfolioUsers, sessionEmail, sessionName]);

  const filteredNodes = useMemo(() => {
    let nodes = portfolio.data?.nodes ?? [];
    if (focusProjectId) {
      nodes = nodes.filter((n) => n.project_id === focusProjectId);
    }
    if (myTasks && currentUserId) {
      nodes = nodes.filter((n) => n.responsible_id === currentUserId || n.task_assignees?.some((a) => a.user_id === currentUserId));
    }
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      nodes = nodes.filter((n) => n.name.toLowerCase().includes(lower) || (n.description ?? '').toLowerCase().includes(lower));
    }
    if (typeFilter) nodes = nodes.filter((n) => n.type === typeFilter);
    if (showUnscheduled) nodes = nodes.filter((n) => n.is_unscheduled);
    return nodes;
  }, [portfolio.data?.nodes, searchTerm, typeFilter, showUnscheduled, myTasks, focusProjectId, currentUserId]);

  const filteredBacklog = useMemo(() => {
    let backlog = portfolio.data?.backlog ?? [];
    if (focusProjectId) backlog = backlog.filter((n) => n.project_id === focusProjectId);
    if (myTasks && currentUserId) {
      backlog = backlog.filter((n) => n.responsible_id === currentUserId || n.task_assignees?.some((a) => a.user_id === currentUserId));
    }
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      backlog = backlog.filter((n) => n.name.toLowerCase().includes(lower));
    }
    if (typeFilter) backlog = backlog.filter((n) => n.type === typeFilter);
    return backlog;
  }, [portfolio.data?.backlog, searchTerm, typeFilter, myTasks, focusProjectId, currentUserId]);

  const ganttNodes = useMemo(() => {
    if (!showBacklogInGantt) return filteredNodes;
    const today = new Date().toISOString().slice(0, 10);
    const byId = new Map<string, WbsNode>();
    // Usamos también los nodos del backlog para poder resolver padres que aún estén sin fechas.
    filteredNodes.forEach((n) => byId.set(n.id, n));
    filteredBacklog.forEach((n) => byId.set(n.id, n));

    // Si dibujamos backlog siempre en "hoy", puede quedar fuera del rango visible del
    // proyecto (por ejemplo si todo el proyecto está en 2027). Para hacerlo descubrible,
    // anclamos los ítems de backlog al rango del padre cuando exista.
    const backlogAsGantt = filteredBacklog.map((n) => {
      const parent = n.parent_id ? byId.get(n.parent_id) ?? null : null;
      const anchor = parent?.start_date ?? parent?.end_date ?? null;
      const placeholder = n.start_date ?? anchor ?? today;
      return {
        ...n,
        is_unscheduled: false as boolean,
        start_date: placeholder,
        end_date: n.end_date ?? placeholder,
        color: n.color ?? '#b0b5c1',
        _from_backlog: true as boolean,
      };
    });
    return [...filteredNodes, ...backlogAsGantt];
  }, [filteredNodes, filteredBacklog, showBacklogInGantt]);

  const syncUrl = useCallback((params: Record<string, string>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(params).forEach(([k, v]) => {
      if (v) next.set(k, v); else next.delete(k);
    });
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const hasActiveFilters = !!(searchTerm || typeFilter || showUnscheduled || myTasks || focusProjectId || projectFilter || responsibleFilter || assigneeFilter || statusFilter || dateFrom || dateTo);

  const projectNamesMap = useMemo(() => {
    const map = new Map<string, string>();
    (portfolio.data?.projects ?? []).forEach((p) => map.set(p.id, p.name));
    return map;
  }, [portfolio.data?.projects]);

  const focusProjectName = focusProjectId ? (projectNamesMap.get(focusProjectId) ?? null) : null;

  const handleExport = useCallback(async (format: 'json' | 'csv' | 'html' | 'png') => {
    if (!token || !(portfolio.data?.projects.length)) return;
    const projectId = focusProjectId ?? selectedNode?.project_id ?? portfolio.data.projects[0].id;

    // PNG: captura client-side del Gantt visible en alta DPI.
    if (format === 'png') {
      try {
        const target = document.querySelector('.gantt-region') as HTMLElement | null;
        if (!target) throw new Error('No se encontró el Gantt');
        const { toPng } = await import('html-to-image');
        const dataUrl = await toPng(target, {
          pixelRatio: 2,
          backgroundColor: getComputedStyle(document.body).backgroundColor || '#ffffff',
          cacheBust: true,
        });
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `abax-gantt-${projectId}-${Date.now()}.png`;
        a.click();
        notify({ tone: 'success', title: 'Exportado como PNG' });
      } catch (err) {
        notify({ tone: 'error', title: 'No se pudo exportar PNG', detail: err instanceof Error ? err.message : 'Error' });
      }
      return;
    }

    try {
      const res = await fetch(apiUrl(`api/export/${projectId}?format=${format}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `abax-export-${projectId}-${Date.now()}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      notify({ tone: 'success', title: `Exportado como ${format.toUpperCase()}` });
    } catch {
      notify({ tone: 'error', title: 'No se pudo exportar' });
    }
  }, [notify, token, portfolio.data, focusProjectId, selectedNode]);

  const handleSearch = useCallback((query: string) => {
    setSearchTerm(query);
    if (query && portfolio.data?.nodes) {
      const match = portfolio.data.nodes.find((n) => n.name.toLowerCase().includes(query.toLowerCase()));
      if (match) onSelectNode(match);
    }
  }, [onSelectNode, portfolio.data]);

  // currentUserId ya calculado arriba (antes de filteredNodes).
  // Se movió para poder usarlo en el filtro myTasks y filteredBacklog.

  if (!token) return <Navigate to="/login" replace />;
  const userName = session?.userName ?? 'Usuario';

  const handleCreateProject = async (name: string) => {
    try {
      const created = await createProject(token, name);
      const data = await portfolio.refetch();
      const rootNodeId = created.root_node?.id ?? (created as { root_node_id?: string }).root_node_id;
      const fromPortfolio = rootNodeId ? data?.nodes.find((node) => node.id === rootNodeId) : undefined;
      if (fromPortfolio) onSelectNode(fromPortfolio);
      else if (created.root_node) onSelectNode(created.root_node);
      notify({ tone: 'success', title: 'Proyecto creado' });
    } catch (error) {
      notify({ tone: 'error', title: 'No se pudo crear proyecto', detail: errorMessage(error) });
      throw error;
    }
  };

  const handleCreateChild = async (input: { name: string; type: NodeType; start_date: string | null; end_date: string | null }) => {
    if (!selectedNode || !selectedNode.id) {
      notify({ tone: 'error', title: 'Selecciona un nodo padre primero', detail: 'Haz click en un proyecto, etapa, grupo o tarea en el árbol y vuelve a intentar.' });
      return;
    }
    // Si el id seleccionado no parece UUID, intentar resolver al UUID real desde portfolio.
    // (Defensa contra eventos de DHTMLX o estado desactualizado.)
    let parentId = selectedNode.id;
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(parentId)) {
      const realNode = portfolio.data?.nodes.find((n) => n.id === selectedNode.id || (n.name === selectedNode.name && UUID_RE.test(n.id)));
      if (realNode && UUID_RE.test(realNode.id)) {
        parentId = realNode.id;
        onSelectNode(realNode);
      } else {
        notify({ tone: 'error', title: 'No se reconoce el padre seleccionado', detail: `Vuelve a seleccionar el nodo en el Gantt y reintenta.` });
        return;
      }
    }
    try {
      const created = await createWbsNode(token, {
        parent_id: parentId,
        name: input.name,
        type: input.type,
        start_date: input.start_date,
        end_date: input.end_date,
      });
      const data = await portfolio.refetch();
      onSelectNode(data?.nodes.find((node) => node.id === created.id) ?? created);

      // Si el usuario crea un hijo sin fechas, el backend lo envía al backlog.
      // Para evitar confusión ("no aparece en el Gantt"), abrimos el backlog y
      // forzamos la visualización de backlog en el Gantt si estaba apagada.
      if (created.is_unscheduled) {
        setBacklogOpen(true);
        if (!showBacklogInGantt) {
          setShowBacklogInGantt(true);
          syncUrl({ backlog_gantt: '' });
        }
      }
      notify({ tone: 'success', title: 'Nodo creado' });
    } catch (error) {
      notify({ tone: 'error', title: 'No se pudo crear nodo', detail: errorMessage(error) });
      throw error;
    }
  };

  return (
    <AppShell summary={portfolio.data?.summary ?? null} userName={userName} onLogout={onLogout} onSearch={handleSearch} onOpenAdmin={() => navigate('/admin')} breadcrumb={focusProjectName ? `Proyecto · ${focusProjectName}` : (myTasks ? 'Mis tareas' : 'Vista consolidada')} detailVisible={detailVisible} onToggleDetail={toggleDetail} fullscreen={isFullscreen}>
      {showMobileList ? (
        <MobileTaskList
          nodes={portfolio.data?.nodes ?? []}
          users={portfolio.data?.users ?? []}
          currentUserId={currentUserId}
          role={role}
          onSelectNode={onSelectNode}
          onReportProgress={async (nodeId, input) => {
            if (!token) return;
            try {
              const result = await reportProgress(token, nodeId, { progress: input.progress, hours: input.hours ?? null });
              portfolio.updateNodeLocal(result.node);
              notify({ tone: 'success', title: input.hours ? 'Horas registradas' : 'Avance reportado' });
            } catch (error) {
              notify({ tone: 'error', title: 'No se pudo guardar', detail: errorMessage(error) });
            }
          }}
          onShowGantt={() => toggleMobileMode(true)}
        />
      ) : (
      <>
      {isFullscreen && (
        <button className="fullscreen-exit" onClick={() => setIsFullscreen(false)} title="Salir de pantalla completa">
          ⛶ Salir
        </button>
      )}
      {isMobile && mobileForceGantt && (
        <div className="mobile-back-to-list">
          <button onClick={() => toggleMobileMode(false)}>← Volver a la lista</button>
        </div>
      )}
      {!isFullscreen && (
      <>
      <FilterBar
        search={searchTerm}
        onSearch={(q) => { setSearchTerm(q); syncUrl({ q: q || '' }); }}
        typeFilter={typeFilter}
        onTypeFilter={(t) => { setTypeFilter(t); syncUrl({ type: t ?? '' }); }}
        showUnscheduled={showUnscheduled}
        onShowUnscheduled={(s) => { setShowUnscheduled(s); syncUrl({ unscheduled: s ? '1' : '' }); }}
        showBacklogInGantt={showBacklogInGantt}
        onShowBacklogInGantt={(s) => { setShowBacklogInGantt(s); syncUrl({ backlog_gantt: s ? '' : 'false' }); }}
        projectFilter={projectFilter}
        onProjectFilter={(id) => { setProjectFilter(id); syncUrl({ project_id: id ?? '' }); }}
        projectOptions={portfolio.data?.projects ?? []}
        responsibleFilter={responsibleFilter}
        onResponsibleFilter={(id) => { setResponsibleFilter(id); syncUrl({ responsible_id: id ?? '' }); }}
        assigneeFilter={assigneeFilter}
        onAssigneeFilter={(id) => { setAssigneeFilter(id); syncUrl({ assignee_id: id ?? '' }); }}
        statusFilter={statusFilter}
        onStatusFilter={(s) => { setStatusFilter(s); syncUrl({ status: s ?? '' }); }}
        dateFrom={dateFrom}
        onDateFrom={(d) => { setDateFrom(d); syncUrl({ date_from: d }); }}
        dateTo={dateTo}
        onDateTo={(d) => { setDateTo(d); syncUrl({ date_to: d }); }}
        activeOnly={activeOnly}
        onActiveOnly={(v) => { setActiveOnly(v); syncUrl({ active_only: v ? '' : 'false' }); }}
        totalVisible={filteredNodes.length + filteredBacklog.length}
        hasActiveFilters={hasActiveFilters}
        onClear={() => {
          setSearchTerm(''); setTypeFilter(null); setShowUnscheduled(false); setMyTasks(false);
          setShowBacklogInGantt(true);
          setFocusProjectId(null); setProjectFilter(null); setResponsibleFilter(null);
          setAssigneeFilter(null); setStatusFilter(null); setDateFrom(''); setDateTo(''); setActiveOnly(true);
          clearAllLocalState();
          syncUrl({ q: '', type: '', unscheduled: '', my: '', focus: '', project_id: '', responsible_id: '', assignee_id: '', status: '', date_from: '', date_to: '', backlog_gantt: '' });
        }}
        users={portfolio.data?.users ?? []}
      />
      <Toolbar
        totalNodes={filteredNodes.length}
        selectedName={selectedNode?.name ?? null}
        onCreateProject={() => setCreateMode('project')}
        onCreateChild={() => {
          if (!selectedNode || !selectedNode.id) {
            notify({ tone: 'error', title: 'Selecciona un nodo padre primero' });
            return;
          }
          setCreateMode('child');
        }}
        canEditStructure={canEditStructure}
        onExport={handleExport}
        onMyTasks={() => { setMyTasks((m) => !m); syncUrl({ my: myTasks ? '' : '1' }); }}
        myTasks={myTasks}
        onFocusProject={() => { setFocusProjectId(focusProjectId ? null : (selectedNode?.project_id ?? null)); syncUrl({ focus: focusProjectId ? '' : (selectedNode?.project_id ?? '') }); }}
        focusProjectName={focusProjectName}
        onToday={() => setTodaySignal((t) => t + 1)}
        scale={ganttScale}
        onScaleChange={(next) => {
          setGanttScale(next);
          syncUrl({ scale: next });
        }}
        isFullscreen={isFullscreen}
        onToggleFullscreen={() => setIsFullscreen((v) => !v)}
      />
      </>
      )}
      <main className="workspace">
        {!isFullscreen && (
        <BacklogPanel
          items={filteredBacklog}
          projects={portfolio.data?.projects ?? []}
          users={portfolio.data?.users ?? []}
          open={backlogOpen}
          onToggle={() => setBacklogOpen((current) => !current)}
          onSelectNode={onSelectNode}
          onScheduleNode={handleScheduleNode}
        />
        )}
        <section className="gantt-region">
          {portfolio.status === 'loading' && <GanttSkeleton />}
          {portfolio.status === 'error' && <StatusState title="No se pudo cargar" description={portfolio.error.message} />}
          {portfolio.status === 'ready' && ganttNodes.length === 0 && (
            <StatusState title="Empieza tu primer proyecto" description="Crea un proyecto para iniciar la estructura WBS." action="+ Nuevo proyecto" />
          )}
          {portfolio.status === 'ready' && ganttNodes.length > 0 && (
            <Suspense fallback={<GanttSkeleton />}>
              <ErrorBoundary>
                <GanttCanvas
                nodes={ganttNodes}
                dependencies={portfolio.data.dependencies}
                users={portfolio.data.users}
                onSelectNode={onSelectNode}
                onCreateDependency={handleCreateDependency}
                onDeleteDependency={handleDeleteDependency}
                onMoveNode={handleMoveNode}
                onUpdateDates={async (nodeId, input) => {
                  if (!token) return;
                  const previous = portfolio.data?.nodes.find((n) => n.id === nodeId);
                  if (previous) {
                    portfolio.updateNodeLocal({ ...previous, start_date: input.start_date, end_date: input.end_date, is_unscheduled: false });
                  }
                  try {
                    const updated = await scheduleWbsNode(token, nodeId, input);
                    portfolio.updateNodeLocal(updated);
                    notify({ tone: 'success', title: 'Fechas guardadas' });
                  } catch (error) {
                    if (previous) portfolio.updateNodeLocal(previous);
                    notify({ tone: 'error', title: 'No se pudieron guardar las fechas', detail: errorMessage(error) });
                    throw error;
                  }
                }}
                onUpdateStatus={async (nodeId, newStatus) => {
                  if (!token) return;
                  const previous = portfolio.data?.nodes.find((n) => n.id === nodeId);
                  if (previous) {
                    portfolio.updateNodeLocal({ ...previous, status: newStatus ?? null });
                  }
                  try {
                    const updated = await updateWbsNode(token, nodeId, { status: newStatus ?? null } as Partial<WbsNode>);
                    portfolio.updateNodeLocal(updated);
                    notify({ tone: 'success', title: 'Estado actualizado' });
                  } catch (error) {
                    if (previous) portfolio.updateNodeLocal(previous);
                    notify({ tone: 'error', title: 'No se pudo actualizar el estado', detail: errorMessage(error) });
                    throw error;
                  }
                }}
                canEditStructure={canEditStructure}
                onValidationError={(message) => notify({ tone: 'error', title: 'Acción inválida', detail: message })}
                todaySignal={todaySignal}
                scale={ganttScale}
                onMoveComplete={() => notify({ tone: 'success', title: 'Movimiento guardado' })}
              />
              </ErrorBoundary>
            </Suspense>
          )}
        </section>
        {!isFullscreen && detailVisible ? (
          <ErrorBoundary>
            <DetailPanel
              key={selectedNode?.id ?? 'empty'}
              node={selectedNode}
              token={token}
              users={portfolio.data?.users ?? []}
              assignees={assignees}
              onSave={handleUpdateNode}
              onUnschedule={handleUnscheduleNode}
              onAddAssignee={handleAddAssignee}
              onRemoveAssignee={handleRemoveAssignee}
              onReportProgress={handleReportProgress}
              onSetResponsible={handleSetResponsible}
              canEditStructure={canEditStructure}
              canReportProgress={canReportProgress}
              onClose={() => setDetailVisible(false)}
            />
          </ErrorBoundary>
        ) : (
          <DetailRail selectedNode={selectedNode} onOpen={() => setDetailVisible(true)} />
        )}
      </main>
      </>
      )}
      <CreateDialog
        key={`${createMode ?? 'closed'}-${selectedNode?.id ?? 'root'}`}
        mode={createMode}
        parent={selectedNode}
        onClose={() => setCreateMode(null)}
        onCreateProject={handleCreateProject}
        onCreateChild={handleCreateChild}
        canEditStructure={canEditStructure}
      />
    </AppShell>
  );
}

function StatusState({ title, description, action }: { title: string; description: string; action?: string }) {
  return (
    <div className="status-state">
      <div className="status-illustration"><span /><span /><span /></div>
      <h2>{title}</h2>
      <p>{description}</p>
      {action && <button className="primary-button">{action}</button>}
    </div>
  );
}
