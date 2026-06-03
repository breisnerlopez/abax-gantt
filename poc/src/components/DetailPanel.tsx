import { useEffect, useRef, useState } from 'react';
import { blockWheel } from '../lib/blockWheel';
type DetailTab = 'info' | 'responsables' | 'ejecutores' | 'avance' | 'horas' | 'presupuesto' | 'adjuntos';
const PRIMARY_TABS: { id: DetailTab; label: string }[] = [
  { id: 'info', label: 'Info' },
  { id: 'responsables', label: 'Responsables' },
  { id: 'ejecutores', label: 'Ejecutores' },
  { id: 'avance', label: 'Avance' },
  { id: 'horas', label: 'Horas' },
];
const SECONDARY_TABS: { id: DetailTab; label: string }[] = [
  { id: 'presupuesto', label: 'Presupuesto' },
  { id: 'adjuntos', label: 'Adjuntos' },
];
const SECONDARY_IDS: DetailTab[] = SECONDARY_TABS.map((t) => t.id);
import { ConfirmDialog } from './ConfirmDialog';
import { TimesheetPanel } from './TimesheetPanel';
import { deleteAttachment, getBudgetReport, listAttachments, uploadAttachment } from '../lib/api';
import type { Attachment, BudgetReport, Profile, TaskAssignee, WbsNode } from '../lib/types';
import { isValidNodeName, validateAttachment, validateDateRange } from '../lib/validation';

const STATUS_OPTIONS = ['pendiente', 'en_progreso', 'completado', 'retrasado', 'cancelado', 'en_pausa', 'en_revision'] as const;

const STATUS_LABELS: Record<string, string> = {
  pendiente: 'Pendiente',
  en_progreso: 'En progreso',
  completado: 'Completado',
  retrasado: 'Retrasado',
  cancelado: 'Cancelado',
  en_pausa: 'En pausa',
  en_revision: 'En revisión',
};

function computeStatus(node: WbsNode): string {
  if (node.status) return node.status;
  const today = new Date().toISOString().slice(0, 10);
  if ((node.progress ?? 0) >= 1) return 'completado';
  if (node.end_date && node.end_date < today) return 'retrasado';
  if ((node.progress ?? 0) > 0) return 'en_progreso';
  return 'pendiente';
}

function statusLabel(node: WbsNode): string {
  return STATUS_LABELS[computeStatus(node)] ?? computeStatus(node);
}

function nodeStatusBadge(node: WbsNode): string {
  const s = computeStatus(node);
  if (STATUS_OPTIONS.includes(s as typeof STATUS_OPTIONS[number])) return s;
  return 'pendiente';
}

interface DetailPanelProps {
  node: WbsNode | null;
  token: string;
  users: Profile[];
  assignees: TaskAssignee[];
  onSave: (id: string, patch: Partial<Pick<WbsNode, 'name' | 'description' | 'status' | 'start_date' | 'end_date' | 'progress' | 'estimated_hours'>>) => Promise<void>;
  onUnschedule: (node: WbsNode) => Promise<void>;
  onAddAssignee: (userId: string) => Promise<void>;
  onRemoveAssignee: (assignmentId: string) => Promise<void>;
  onReportProgress: (progress: number, hours: number | null) => Promise<void>;
  onSetResponsible: (userId: string | null) => Promise<void>;
  canEditStructure: boolean;
  canReportProgress: boolean;
  /** Callback opcional para cerrar el panel (botón ✕). */
  onClose?: () => void;
  /** Rediseño Fase 4: si el panel está "acoplado" (toma columna propia) o flotante. */
  pinned?: boolean;
  /** Toggle del pin desde el header. Si no se pasa, no se muestra el botón. */
  onTogglePinned?: () => void;
  /** Solicita borrar el nodo (lanza el ConfirmDialog en el padre). El botón
      se muestra si la prop se pasa Y canEditStructure. Para proyectos el
      dialog del padre detalla el alcance de la eliminación. */
  onDeleteRequest?: (node: WbsNode) => void;
  /** Fase 9 + post: editor de equipo. teams = equipos activos disponibles.
      `currentTeamId` viene de portfolio.data.projects[i].team_id porque el
      DetailPanel recibe un WbsNode (no un Project). */
  teams?: import('../lib/types').Team[];
  currentTeamId?: string | null;
  onSaveTeam?: (projectId: string, teamId: string | null) => Promise<void>;
}

type SaveState = 'saved' | 'saving' | 'error';

export function DetailPanel({ node, token, users, assignees, onSave, onUnschedule, onAddAssignee, onRemoveAssignee, onReportProgress, onSetResponsible, canEditStructure, canReportProgress, onClose, pinned, onTogglePinned, onDeleteRequest, teams, currentTeamId, onSaveTeam }: DetailPanelProps) {
  const [form, setForm] = useState(() => toForm(node));
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [activeTab, setActiveTab] = useState<DetailTab>('info');
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const dirtyRef = useRef(false);

  useEffect(() => {
    if (!moreOpen) return;
    const closer = (e: MouseEvent) => {
      if (!moreRef.current?.contains(e.target as Node)) setMoreOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMoreOpen(false); };
    document.addEventListener('mousedown', closer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', closer);
      document.removeEventListener('keydown', onKey);
    };
  }, [moreOpen]);

  const activeInSecondary = SECONDARY_IDS.includes(activeTab);
  const secondaryActive = SECONDARY_TABS.find((t) => t.id === activeTab) ?? null;

  useEffect(() => {
    if (!node || !dirtyRef.current) return;
    const timer = window.setTimeout(() => {
      const name = isValidNodeName(form.name);
      const dates = validateDateRange(form.start_date || null, form.end_date || null);
      if (!name.ok || !dates.ok) {
        setSaveState('error');
        return;
      }
      dirtyRef.current = false;
      setSaveState('saving');
      // Importante: NO incluir `progress` aquí. Ese campo se gestiona desde la pestaña
      // "Avance" con su propio autosave debounced. Si lo enviamos también desde aquí,
      // el form viejo pisaría el cambio del slider en cuanto cambie cualquier dep del
      // useEffect (node, onSave, etc.).
      onSave(node.id, {
        name: form.name,
        description: form.description || null,
        status: form.status || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        estimated_hours: form.estimated_hours === '' ? null : Number(form.estimated_hours),
      })
        .then(() => setSaveState('saved'))
        .catch(() => setSaveState('error'));
    }, 500);
    return () => window.clearTimeout(timer);
  }, [form, node, onSave]);

  if (!node) {
    return (
      <aside className="detail-panel detail-panel--empty">
        <div className="detail-header detail-header--empty">
          {onClose && (
            <button type="button" className="detail-header-close" title="Colapsar panel" aria-label="Colapsar panel" onClick={onClose}>›</button>
          )}
          <div className="detail-header-text">
            <p>Detalle</p>
            <h2>Sin selección</h2>
          </div>
        </div>
        <section className="status-state">
          <div className="status-illustration"><span /><span /><span /></div>
          <h2>Selecciona un nodo</h2>
          <p>El panel mostrara responsables, avance, presupuesto y adjuntos del elemento activo.</p>
        </section>
      </aside>
    );
  }

  const update = (field: keyof typeof form, value: string) => {
    dirtyRef.current = true;
    setForm((current) => ({ ...current, [field]: value }));
  };

  return (
    <aside className={'detail-panel' + (pinned === false ? ' detail-panel--floating' : '')}>
      <div className="detail-header">
        <div className="detail-header-actions">
          {onTogglePinned && (
            <button
              type="button"
              className={'detail-header-pin' + (pinned !== false ? ' is-on' : '')}
              title={pinned !== false ? 'Desacoplar (panel flotante)' : 'Acoplar al borde'}
              aria-label={pinned !== false ? 'Desacoplar panel' : 'Acoplar panel'}
              aria-pressed={pinned !== false}
              onClick={onTogglePinned}
            >
              📌
            </button>
          )}
          {onClose && (
            <button
              type="button"
              className="detail-header-close"
              title="Cerrar panel"
              aria-label="Cerrar panel de detalle"
              onClick={onClose}
            >
              ✕
            </button>
          )}
        </div>
        <span className={`type-dot type-dot--${node.type}`} />
        <div className="detail-header-text">
          <p>{labelForType(node.type)} <span className={`status ${nodeStatusBadge(node)}`}><span className="status-dot" />{statusLabel(node)}</span></p>
          <h2>{node.name}</h2>
          {node.responsible_id && <small>Responsable: {displayUser(users.find((user) => user.id === node.responsible_id))}</small>}
        </div>
      </div>
      <nav className="detail-tabs" role="tablist" aria-label="Secciones del nodo">
        {PRIMARY_TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={activeTab === t.id}
            className={activeTab === t.id ? 'active' : ''}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
        {/* Tab "Más ▾" agrupa Presupuesto y Adjuntos para seguir el patrón de
            5 tabs principales del rediseño sin perder la funcionalidad. */}
        <div className="detail-tabs-more" ref={moreRef}>
          <button
            type="button"
            role="tab"
            aria-haspopup="menu"
            aria-expanded={moreOpen}
            aria-selected={activeInSecondary}
            className={activeInSecondary ? 'active' : ''}
            onClick={() => setMoreOpen((v) => !v)}
          >
            {secondaryActive ? secondaryActive.label : 'Más'} <span aria-hidden="true">▾</span>
          </button>
          {moreOpen && (
            <div className="detail-tabs-more-menu" role="menu">
              {SECONDARY_TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={activeTab === t.id}
                  className={activeTab === t.id ? 'is-on' : ''}
                  onClick={() => { setActiveTab(t.id); setMoreOpen(false); }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </nav>
      {activeTab === 'info' && <div role="tabpanel"><InfoTab node={node} form={form} update={update} onUnschedule={onUnschedule} canEditStructure={canEditStructure} teams={teams} currentTeamId={currentTeamId} onSaveTeam={onSaveTeam} /></div>}
      {activeTab === 'responsables' && <div role="tabpanel"><ResponsibleTab node={node} users={users} onSetResponsible={onSetResponsible} canEditStructure={canEditStructure} /></div>}
      {activeTab === 'ejecutores' && <div role="tabpanel"><ExecutorsTab users={users} assignees={assignees} onAddAssignee={onAddAssignee} onRemoveAssignee={onRemoveAssignee} canEditStructure={canEditStructure} /></div>}
      {activeTab === 'avance' && <div role="tabpanel"><ProgressTab node={node} onReportProgress={onReportProgress} canReportProgress={canReportProgress} /></div>}
      {activeTab === 'horas' && <div role="tabpanel"><TimesheetPanel node={node} token={token} /></div>}
      {activeTab === 'presupuesto' && <div role="tabpanel"><BudgetTab token={token} node={node} /></div>}
      {activeTab === 'adjuntos' && <div role="tabpanel"><AttachmentsTab token={token} node={node} /></div>}
      <footer className={`save-indicator save-indicator--${saveState}`}>
        <span>{saveLabel(saveState)}</span>
        {onDeleteRequest && canEditStructure && (
          <button
            type="button"
            className="detail-delete-btn"
            title={node.type === 'project'
              ? 'Eliminar proyecto completo (Cmd/Ctrl + Shift + ⌫)'
              : 'Eliminar nodo (Cmd/Ctrl + Shift + ⌫)'}
            onClick={() => onDeleteRequest(node)}
          >
            {node.type === 'project' ? 'Eliminar proyecto' : 'Eliminar'}
          </button>
        )}
      </footer>
    </aside>
  );
}

function ResponsibleTab({ node, users, onSetResponsible, canEditStructure }: { node: WbsNode; users: Profile[]; onSetResponsible: (userId: string | null) => Promise<void>; canEditStructure: boolean }) {
  const [selectedUser, setSelectedUser] = useState(node.responsible_id ?? '');
  const [saving, setSaving] = useState(false);
  const activeUsers = users.filter((user) => user.status === 'active');
  const current = users.find((user) => user.id === node.responsible_id) ?? null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await onSetResponsible(selectedUser || null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="detail-content">
      <div className="responsible-card">
        <span className="mini-avatar">{initials(displayUser(current))}</span>
        <div>
          <b>{current ? displayUser(current) : 'Sin responsable directo'}</b>
          <small>{current?.email ?? 'Heredará permisos desde un ancestro si aplica'}</small>
        </div>
      </div>
      <form className="assign-form" onSubmit={submit}>
        <label className="edit-field">
          <span>Designar responsable</span>
          <select value={selectedUser} onWheel={blockWheel} onChange={(event) => setSelectedUser(event.target.value)} disabled={!canEditStructure}>
            <option value="">Sin responsable directo</option>
            {activeUsers.map((user) => <option key={user.id} value={user.id}>{displayUser(user)}</option>)}
          </select>
        </label>
        <button className="primary-button" type="submit" disabled={saving || !canEditStructure}>{saving ? 'Guardando...' : 'Guardar responsable'}</button>
      </form>
      <div className="detail-callout">El responsable controla este nodo y toda su descendencia sin responsable propio.</div>
    </section>
  );
}

function InfoTab({
  node, form, update, onUnschedule, canEditStructure,
  teams, currentTeamId, onSaveTeam,
}: {
  node: WbsNode;
  form: ReturnType<typeof toForm>;
  update: (field: keyof ReturnType<typeof toForm>, value: string) => void;
  onUnschedule: (node: WbsNode) => Promise<void>;
  canEditStructure: boolean;
  teams?: import('../lib/types').Team[];
  currentTeamId?: string | null;
  onSaveTeam?: (projectId: string, teamId: string | null) => Promise<void>;
}) {
  const isProject = node.type === 'project';
  const showTeamField = isProject && onSaveTeam !== undefined;
  const [savingTeam, setSavingTeam] = useState(false);
  return (
    <section className="detail-content">
      {!canEditStructure && <div className="detail-callout">Modo lectura. Como ejecutor solo puedes reportar avance y horas.</div>}
      {node.is_unscheduled
        ? <div className="detail-callout">Este nodo está en backlog. Asigna fechas para programarlo en el timeline.</div>
        : node.type === 'task' && canEditStructure && <button className="danger-soft-button" onClick={() => void onUnschedule(node)}>Enviar al backlog</button>}
      <label className="edit-field"><span>Nombre</span><input value={form.name} disabled={!canEditStructure} onChange={(event) => update('name', event.target.value)} /></label>
      <label className="edit-field"><span>Descripción</span><textarea value={form.description} disabled={!canEditStructure} onChange={(event) => update('description', event.target.value)} /></label>
      {showTeamField && (
        <label className="edit-field">
          <span>Equipo</span>
          <select
            value={currentTeamId ?? ''}
            disabled={!canEditStructure || savingTeam}
            onWheel={blockWheel}
            onChange={async (e) => {
              const newValue = e.target.value || null;
              if (newValue === (currentTeamId ?? null)) return;
              setSavingTeam(true);
              try {
                // node.project_id en un root project apunta al proyecto mismo
                await onSaveTeam!(node.project_id, newValue);
              } finally {
                setSavingTeam(false);
              }
            }}
          >
            <option value="">Sin equipo</option>
            {(teams ?? []).map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          {(teams ?? []).length === 0 && (
            <small style={{ color: 'var(--text-faint)', fontSize: 11, marginTop: 4, display: 'block' }}>
              Crea equipos desde Admin para asignarlos aquí.
            </small>
          )}
        </label>
      )}
      <label className="edit-field"><span>Estado</span>
        <select value={form.status ?? ''} disabled={!canEditStructure} onWheel={blockWheel} onChange={(event) => update('status', event.target.value)}>
          <option value="">Automático ({statusLabel(node)})</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
        <small style={{ color: 'var(--text-tertiary)', fontSize: 11, marginTop: 4, display: 'block' }}>
          Dejar en &quot;Automático&quot; calcula el estado del avance y las fechas.
        </small>
      </label>
      <div className="field-grid">
        {(() => {
          const isContainer = node.type === 'project' || node.type === 'stage' || node.type === 'group';
          const datesDisabled = !canEditStructure || isContainer;
          return (
            <>
              <label className="edit-field">
                <span>Inicio</span>
                <input type="date" value={form.start_date} disabled={datesDisabled} onWheel={blockWheel} onChange={(event) => update('start_date', event.target.value)} />
                {isContainer && <small style={{ color: 'var(--text-tertiary)', fontSize: 11, marginTop: 4, display: 'block' }}>Calculado desde la fecha más temprana de los hijos.</small>}
              </label>
              <label className="edit-field">
                <span>Fin</span>
                <input type="date" value={form.end_date} disabled={datesDisabled} onWheel={blockWheel} onChange={(event) => update('end_date', event.target.value)} />
                {isContainer && <small style={{ color: 'var(--text-tertiary)', fontSize: 11, marginTop: 4, display: 'block' }}>Calculado desde la fecha más tardía de los hijos.</small>}
              </label>
              <label className="edit-field"><span>Horas estimadas</span><input type="number" min="0" value={form.estimated_hours} disabled={!canEditStructure} onWheel={blockWheel} onChange={(event) => update('estimated_hours', event.target.value)} /></label>
            </>
          );
        })()}
      </div>
    </section>
  );
}

function ExecutorsTab({ users, assignees, onAddAssignee, onRemoveAssignee, canEditStructure }: { users: Profile[]; assignees: TaskAssignee[]; onAddAssignee: (userId: string) => Promise<void>; onRemoveAssignee: (assignmentId: string) => Promise<void>; canEditStructure: boolean }) {
  const [selectedUser, setSelectedUser] = useState('');
  const assignedIds = new Set(assignees.map((item) => item.user_id));
  const availableUsers = users.filter((user) => user.status === 'active' && !assignedIds.has(user.id));

  return (
    <section className="detail-content">
      <div className="assignee-list">
        {assignees.length === 0 && <p>No hay ejecutores asignados.</p>}
        {assignees.map((item) => {
          const assignmentId = item.id;
          return (
            <div key={assignmentId ?? item.user_id} className="assignee-row">
              <span className="mini-avatar">{initials(item.profiles?.full_name ?? 'Usuario')}</span>
              <div><b>{item.profiles?.full_name ?? item.user_id}</b><small>{item.profiles?.email}</small></div>
              {assignmentId && canEditStructure && <button onClick={() => void onRemoveAssignee(assignmentId)}>Quitar</button>}
            </div>
          );
        })}
      </div>
      <form className="assign-form" onSubmit={(event) => { event.preventDefault(); if (selectedUser) void onAddAssignee(selectedUser); setSelectedUser(''); }}>
        <label className="edit-field">
          <span>Asignar ejecutor</span>
          <select value={selectedUser} onWheel={blockWheel} onChange={(event) => setSelectedUser(event.target.value)} disabled={!canEditStructure}>
            <option value="">Selecciona usuario activo</option>
            {availableUsers.map((user) => <option key={user.id} value={user.id}>{user.full_name ?? user.email ?? user.id}</option>)}
          </select>
        </label>
        <button className="primary-button" type="submit" disabled={!selectedUser || !canEditStructure}>Asignar</button>
      </form>
      {users.length === 0 && <div className="detail-callout">No hay usuarios activos disponibles para asignar.</div>}
    </section>
  );
}

function ProgressTab({ node, onReportProgress, canReportProgress }: { node: WbsNode; onReportProgress: (progress: number, hours: number | null) => Promise<void>; canReportProgress: boolean }) {
  // Como el key del DetailPanel padre incluye node.id, este componente se re-monta cuando
  // cambia el nodo seleccionado.
  const initialProgress = Math.round((node.progress ?? 0) * 100);
  const [progress, setProgress] = useState(initialProgress);
  const [hours, setHours] = useState('');
  const [saving, setSaving] = useState(false);
  // Refs siempre con valores frescos para usar en el flush.
  const onReportProgressRef = useRef(onReportProgress);
  useEffect(() => { onReportProgressRef.current = onReportProgress; }, [onReportProgress]);
  const debounceRef = useRef<number | undefined>(undefined);
  const pendingValueRef = useRef<number | null>(null);
  const lastSavedRef = useRef<number>(initialProgress);

  // Persiste el valor pendiente (si lo hay) inmediatamente.
  const flushPending = async () => {
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = undefined;
    }
    const value = pendingValueRef.current;
    if (value === null) return;
    if (value === lastSavedRef.current) {
      pendingValueRef.current = null;
      return;
    }
    pendingValueRef.current = null;
    setSaving(true);
    try {
      await onReportProgressRef.current(value / 100, null);
      lastSavedRef.current = value;
    } catch { /* handler externo notifica error */ }
    finally { setSaving(false); }
  };

  // Programa flush con debounce. Si flushPending se llama explícito antes (mouseup,
  // beforeunload, submit horas), se persiste inmediato.
  const scheduleCommit = (value: number) => {
    if (!canReportProgress) return;
    pendingValueRef.current = value;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => { void flushPending(); }, 400);
  };

  // Cleanup + beforeunload guard: si el usuario refresca con un cambio pendiente,
  // forzar el commit ahora (envío sincrónico best-effort).
  useEffect(() => {
    const handler = () => { void flushPending(); };
    window.addEventListener('beforeunload', handler);
    return () => {
      window.removeEventListener('beforeunload', handler);
      // Al desmontar (cambio de selección), flush pendiente.
      void flushPending();
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, []);

  const handleSliderChange = (value: number) => {
    setProgress(value);
    scheduleCommit(value);
  };

  // Cuando el usuario suelta el slider, NO esperamos los 400ms — flush inmediato.
  const handleSliderRelease = (value: number) => {
    pendingValueRef.current = value;
    void flushPending();
  };

  const submitHours = async (event: React.FormEvent) => {
    event.preventDefault();
    if (hours === '' || !canReportProgress) return;
    // Primero, asegurar que el último progress está guardado.
    await flushPending();
    setSaving(true);
    try {
      await onReportProgressRef.current(progress / 100, Number(hours));
      setHours('');
      lastSavedRef.current = progress;
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="detail-content progress-form">
      <label className="edit-field">
        <span>Avance: {progress}% {saving && <em style={{ marginLeft: 8, color: 'var(--text-tertiary)', fontStyle: 'normal', fontSize: 11 }}>guardando…</em>}</span>
        <input
          type="range"
          min="0"
          max="100"
          step="5"
          value={progress}
          disabled={!canReportProgress}
          onChange={(event) => handleSliderChange(Number(event.target.value))}
          onMouseUp={(event) => handleSliderRelease(Number((event.target as HTMLInputElement).value))}
          onTouchEnd={(event) => handleSliderRelease(Number((event.target as HTMLInputElement).value))}
          onBlur={(event) => handleSliderRelease(Number((event.target as HTMLInputElement).value))}
        />
      </label>
      <form onSubmit={submitHours} style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <label className="edit-field" style={{ flex: 1 }}>
          <span>Registrar horas reales</span>
          <input type="number" min="0.25" step="0.25" value={hours} disabled={!canReportProgress} onChange={(event) => setHours(event.target.value)} placeholder="ej. 2.5" />
        </label>
        <button className="primary-button" type="submit" disabled={saving || !canReportProgress || hours === ''}>{saving ? 'Guardando…' : 'Registrar'}</button>
      </form>
    </section>
  );
}

function BudgetTab({ token, node }: { token: string; node: WbsNode }) {
  const [report, setReport] = useState<BudgetReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getBudgetReport(token, node.project_id)
      .then((data) => { if (!cancelled) setReport(data); })
      .catch((err: unknown) => { if (!cancelled) setError(err instanceof Error ? err.message : 'No se pudo cargar presupuesto'); });
    return () => { cancelled = true; };
  }, [node.project_id, token]);

  if (error) return <section className="detail-content"><div className="detail-callout">{error}</div></section>;
  if (!report) return <section className="detail-content"><div className="detail-callout">Cargando presupuesto...</div></section>;

  return (
    <section className="detail-content">
      <div className="budget-grid">
        <Metric label="Presupuesto" value={currency(report.budget.total)} />
        <Metric label="Costo estimado" value={currency(report.budget.estimated_cost)} />
        <Metric label="Horas estimadas" value={`${report.hours.estimated} h`} />
        <Metric label="Horas reales" value={`${report.hours.actual} h`} />
        <Metric label="Avance ponderado" value={`${report.progress}%`} />
        <Metric label="Tareas" value={String(report.task_count)} />
      </div>
      <div className="detail-callout">Consumo estimado: {report.budget.consumed_pct}% · Variación horas: {report.hours.variance_pct}%</div>
    </section>
  );
}

function AttachmentsTab({ token, node }: { token: string; node: WbsNode }) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Attachment | null>(null);

  const reload = async () => {
    setAttachments(await listAttachments(token, node.project_id));
  };

  useEffect(() => {
    let cancelled = false;
    listAttachments(token, node.project_id)
      .then((items) => { if (!cancelled) setAttachments(items); })
      .catch((err: unknown) => { if (!cancelled) setError(err instanceof Error ? err.message : 'No se pudieron cargar adjuntos'); });
    return () => { cancelled = true; };
  }, [node.project_id, token]);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setSaving(true);
    setError(null);
    try {
      const validation = validateAttachment(file);
      if (!validation.ok) throw new Error(validation.message);
      await uploadAttachment(token, node.project_id, file);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo subir archivo');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (attachment: Attachment) => {
    setSaving(true);
    try {
      await deleteAttachment(token, attachment.id);
      await reload();
    } finally {
      setSaving(false);
      setPendingDelete(null);
    }
  };

  return (
    <section className="detail-content">
      <label className="upload-box">
        <span>{saving ? 'Procesando...' : 'Subir adjunto'}</span>
        <input type="file" disabled={saving} onChange={(event) => void upload(event.target.files?.[0])} />
      </label>
      {error && <div className="detail-callout">{error}</div>}
      <div className="attachment-list">
        {attachments.length === 0 && <p>No hay adjuntos en este proyecto.</p>}
        {attachments.map((attachment) => (
          <div key={attachment.id} className="attachment-row">
            <a href={attachment.download_url ?? '#'} target="_blank" rel="noreferrer">{attachment.file_name}</a>
            <span>{formatBytes(attachment.file_size)}</span>
            <button onClick={() => setPendingDelete(attachment)} disabled={saving}>Eliminar</button>
          </div>
        ))}
      </div>
      {pendingDelete && (
        <ConfirmDialog
          title="Eliminar adjunto"
          description={`Se eliminara ${pendingDelete.file_name}. Esta accion no se puede deshacer.`}
          confirmLabel="Eliminar"
          busy={saving}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => void remove(pendingDelete)}
        />
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="metric-card"><span>{label}</span><b>{value}</b></div>;
}

function initials(name: string) {
  return name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}

function displayUser(user: Profile | null | undefined) {
  return user?.full_name ?? user?.email ?? 'Usuario';
}

const currencyFormatter = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });

function currency(value: number) {
  return currencyFormatter.format(value);
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
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

function toForm(node: WbsNode | null) {
  return {
    name: node?.name ?? '',
    description: node?.description ?? '',
    status: node?.status ?? '',
    start_date: (node?.start_date ?? '').slice(0, 10),
    end_date: (node?.end_date ?? '').slice(0, 10),
    estimated_hours: node?.estimated_hours == null ? '' : String(node.estimated_hours),
  };
}

function saveLabel(state: SaveState) {
  if (state === 'saving') return 'Guardando...';
  if (state === 'error') return 'Error al guardar';
  return 'Guardado';
}
