/**
 * FilterBar — orden y comportamiento del rediseño Fase 3 (handoff §5.5):
 *   Buscar → Estado (pills semáforo, siempre visibles) → Tipo (dropdown
 *   exclusivo) → Más filtros (responsable/ejecutor/backlog/cerrados/matchScope).
 *
 * Lado derecho: contador de filtros activos + Limpiar + Nº elementos.
 *
 * Chips activos en línea para indicar de un vistazo qué filtros están
 * aplicados (ej. "Resp: María", "Solo proyectos").
 */
import { useEffect, useRef, useState } from 'react';
import { SearchableSelect } from './SearchableSelect';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { blockWheel } from '../lib/blockWheel';
import { STATUS_LABELS, STATUS_SEMAPHORE } from '../lib/status';
import type { NodeType, Team } from '../lib/types';

interface FilterBarProps {
  search: string;
  onSearch: (query: string) => void;
  typeFilter: NodeType | null;
  onTypeFilter: (type: NodeType | null) => void;
  showUnscheduled: boolean;
  onShowUnscheduled: (show: boolean) => void;
  showBacklogInGantt: boolean;
  onShowBacklogInGantt: (show: boolean) => void;
  projectFilter: string | null;
  onProjectFilter: (id: string | null) => void;
  projectOptions: Array<{ id: string; name: string }>;
  responsibleFilter: string | null;
  onResponsibleFilter: (id: string | null) => void;
  assigneeFilter: string | null;
  onAssigneeFilter: (id: string | null) => void;
  statusFilter: string | null;
  onStatusFilter: (status: string | null) => void;
  dateFrom: string;
  onDateFrom: (date: string) => void;
  dateTo: string;
  onDateTo: (date: string) => void;
  activeOnly: boolean;
  onActiveOnly: (active: boolean) => void;
  matchScope: 'all' | 'projects';
  onMatchScope: (scope: 'all' | 'projects') => void;
  teamFilter?: string | null;
  onTeamFilter?: (id: string | null) => void;
  teams?: Team[];
  totalVisible: number;
  hasActiveFilters: boolean;
  onClear: () => void;
  users: Array<{ id: string; full_name: string | null; email: string | null }>;
}

const nodeTypes: NodeType[] = ['project', 'stage', 'group', 'task', 'milestone'];
const nodeTypeLabels: Record<NodeType, string> = {
  project: 'Proyecto',
  stage: 'Etapa',
  group: 'Grupo',
  task: 'Tarea',
  milestone: 'Hito',
};

export function FilterBar({
  search, onSearch, typeFilter, onTypeFilter, showUnscheduled, onShowUnscheduled,
  showBacklogInGantt, onShowBacklogInGantt,
  projectFilter, onProjectFilter, projectOptions,
  responsibleFilter, onResponsibleFilter,
  assigneeFilter, onAssigneeFilter,
  statusFilter, onStatusFilter,
  dateFrom, onDateFrom, dateTo, onDateTo,
  activeOnly, onActiveOnly,
  matchScope, onMatchScope,
  teamFilter, onTeamFilter, teams,
  totalVisible, hasActiveFilters, onClear, users,
}: FilterBarProps) {
  // Debounce de la búsqueda: 250ms tras última pulsación.
  const [searchLocal, setSearchLocal] = useState(search);
  const [prevPropSearch, setPrevPropSearch] = useState(search);
  if (search !== prevPropSearch) {
    setPrevPropSearch(search);
    if (search === '') setSearchLocal('');
  }
  const debouncedSearch = useDebouncedValue(searchLocal, 250);
  useEffect(() => { if (debouncedSearch !== search) onSearch(debouncedSearch); }, [debouncedSearch, search, onSearch]);

  // Cuál menú/dropdown está abierto (excluyente).
  type OpenMenu = null | 'tipo' | 'mas';
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const close = () => setOpenMenu(null);

  // Cierra dropdowns al hacer click fuera o pulsar Escape.
  const rootRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!openMenu) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [openMenu]);

  const responsibleName = responsibleFilter ? (users.find((u) => u.id === responsibleFilter)?.full_name ?? 'Usuario') : null;
  const assigneeName = assigneeFilter ? (users.find((u) => u.id === assigneeFilter)?.full_name ?? 'Usuario') : null;
  const projectName = projectFilter ? (projectOptions.find((p) => p.id === projectFilter)?.name ?? projectFilter) : null;
  const teamName = teamFilter ? ((teams ?? []).find((t) => t.id === teamFilter)?.name ?? 'Equipo') : null;

  // Cuenta de filtros activos (mostrar badge a la derecha).
  const activeCount =
    (search ? 1 : 0) +
    (statusFilter ? 1 : 0) +
    (typeFilter ? 1 : 0) +
    (responsibleFilter ? 1 : 0) +
    (assigneeFilter ? 1 : 0) +
    (projectFilter ? 1 : 0) +
    (teamFilter ? 1 : 0) +
    (showUnscheduled ? 1 : 0) +
    (showBacklogInGantt ? 0 : 1) +
    (activeOnly ? 0 : 1) +
    (matchScope === 'projects' ? 1 : 0) +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0);

  // Badge sobre "Más filtros" — sólo cuenta los que viven ahí.
  const moreCount =
    (responsibleFilter ? 1 : 0) +
    (assigneeFilter ? 1 : 0) +
    (projectFilter ? 1 : 0) +
    (teamFilter ? 1 : 0) +
    (showUnscheduled ? 1 : 0) +
    (!showBacklogInGantt ? 1 : 0) +
    (!activeOnly ? 1 : 0) +
    (matchScope === 'projects' ? 1 : 0) +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0);

  return (
    <div className="filterbar" ref={rootRef}>
      {/* 1 · Buscar */}
      <div className="fb-search">
        <input
          type="search"
          placeholder="Filtrar por nombre…"
          aria-label="Filtrar nodos por nombre"
          value={searchLocal}
          onChange={(e) => setSearchLocal(e.target.value)}
        />
      </div>

      <span className="fb-divider" aria-hidden="true" />

      {/* 2 · Estado (pills semáforo, siempre visibles) */}
      <span className="fb-label">Estado</span>
      <button
        type="button"
        className={'qfilter qf-all' + (!statusFilter ? ' is-on' : '')}
        onClick={() => onStatusFilter(null)}
      >
        Todas
      </button>
      {STATUS_SEMAPHORE.map((s) => (
        <button
          key={s}
          type="button"
          className={`qfilter qf-${s}` + (statusFilter === s ? ' is-on' : '')}
          onClick={() => onStatusFilter(statusFilter === s ? null : s)}
          aria-pressed={statusFilter === s}
        >
          <span className="qf-dot" aria-hidden="true" />
          {STATUS_LABELS[s]}
        </button>
      ))}

      <span className="fb-divider" aria-hidden="true" />

      {/* 3 · Tipo (dropdown exclusivo) */}
      <div className="fb-menu-wrap">
        <button
          type="button"
          className={'chip fb-chip' + (typeFilter ? ' is-on' : '')}
          onClick={() => setOpenMenu(openMenu === 'tipo' ? null : 'tipo')}
          aria-expanded={openMenu === 'tipo'}
          aria-haspopup="menu"
        >
          Tipo: {typeFilter ? nodeTypeLabels[typeFilter] : 'Todos'} <span className="fb-chev" aria-hidden="true">▾</span>
        </button>
        {openMenu === 'tipo' && (
          <div className="fb-menu" role="menu">
            <button
              type="button"
              role="menuitemradio"
              aria-checked={!typeFilter}
              className={'fb-menu-item' + (!typeFilter ? ' is-on' : '')}
              onClick={() => { onTypeFilter(null); close(); }}
            >
              Todos
            </button>
            {nodeTypes.map((t) => (
              <button
                key={t}
                type="button"
                role="menuitemradio"
                aria-checked={typeFilter === t}
                className={'fb-menu-item' + (typeFilter === t ? ' is-on' : '')}
                onClick={() => { onTypeFilter(t); close(); }}
              >
                {nodeTypeLabels[t]}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 4 · Más filtros */}
      <div className="fb-menu-wrap">
        <button
          type="button"
          className={'chip fb-chip' + (openMenu === 'mas' || moreCount > 0 ? ' is-on' : '')}
          onClick={() => setOpenMenu(openMenu === 'mas' ? null : 'mas')}
          aria-expanded={openMenu === 'mas'}
          aria-haspopup="menu"
        >
          Más filtros{moreCount > 0 ? ` · ${moreCount}` : ''} <span className="fb-chev" aria-hidden="true">▾</span>
        </button>
        {openMenu === 'mas' && (
          <div className="fb-menu fb-menu-wide" role="menu" aria-label="Filtros avanzados">
            <div className="fb-menu-label">Proyecto</div>
            <div className="fb-menu-field">
              <SearchableSelect
                value={projectFilter ?? ''}
                options={projectOptions.map((p) => ({ id: p.id, label: p.name }))}
                placeholder="Todos"
                ariaLabel="Filtrar por proyecto"
                onChange={(id) => onProjectFilter(id)}
              />
            </div>

            <div className="fb-menu-label">Responsable</div>
            <div className="fb-menu-field">
              <SearchableSelect
                value={responsibleFilter ?? ''}
                options={users.map((u) => ({ id: u.id, label: u.full_name ?? u.email ?? u.id }))}
                placeholder="Cualquiera"
                ariaLabel="Filtrar por responsable"
                onChange={(id) => onResponsibleFilter(id)}
              />
            </div>

            <div className="fb-menu-label">Ejecutor</div>
            <div className="fb-menu-field">
              <SearchableSelect
                value={assigneeFilter ?? ''}
                options={users.map((u) => ({ id: u.id, label: u.full_name ?? u.email ?? u.id }))}
                placeholder="Cualquiera"
                ariaLabel="Filtrar por ejecutor"
                onChange={(id) => onAssigneeFilter(id)}
              />
            </div>

            {onTeamFilter && (
              <>
                <div className="fb-menu-label">Equipo</div>
                <div className="fb-menu-field">
                  <SearchableSelect
                    value={teamFilter ?? ''}
                    options={(teams ?? []).map((t) => ({ id: t.id, label: t.name }))}
                    placeholder={(teams ?? []).length === 0 ? 'Sin equipos creados' : 'Todos'}
                    ariaLabel="Filtrar por equipo"
                    onChange={(id) => onTeamFilter(id)}
                  />
                </div>
              </>
            )}

            <div className="fb-menu-sep" />
            <div className="fb-menu-label">Vista</div>
            <button
              type="button"
              role="menuitemcheckbox"
              aria-checked={showUnscheduled}
              className={'fb-menu-item fb-toggle' + (showUnscheduled ? ' is-on' : '')}
              onClick={() => onShowUnscheduled(!showUnscheduled)}
            >
              <span>Solo backlog</span>
              <span className="fb-toggle-mark" aria-hidden="true" />
            </button>
            <button
              type="button"
              role="menuitemcheckbox"
              aria-checked={showBacklogInGantt}
              className={'fb-menu-item fb-toggle' + (showBacklogInGantt ? ' is-on' : '')}
              onClick={() => onShowBacklogInGantt(!showBacklogInGantt)}
              title="Mostrar tareas del backlog como barras tenues en el Gantt"
            >
              <span>Backlog visible</span>
              <span className="fb-toggle-mark" aria-hidden="true" />
            </button>
            <button
              type="button"
              role="menuitemcheckbox"
              aria-checked={!activeOnly}
              className={'fb-menu-item fb-toggle' + (!activeOnly ? ' is-on' : '')}
              onClick={() => onActiveOnly(!activeOnly)}
            >
              <span>Mostrar cerrados</span>
              <span className="fb-toggle-mark" aria-hidden="true" />
            </button>

            <div className="fb-menu-sep" />
            <div className="fb-menu-label">Aplicar filtros a</div>
            <button
              type="button"
              role="menuitemradio"
              aria-checked={matchScope !== 'projects'}
              className={'fb-menu-item' + (matchScope !== 'projects' ? ' is-on' : '')}
              onClick={() => onMatchScope('all')}
            >
              Todos los niveles
            </button>
            <button
              type="button"
              role="menuitemradio"
              aria-checked={matchScope === 'projects'}
              className={'fb-menu-item' + (matchScope === 'projects' ? ' is-on' : '')}
              onClick={() => onMatchScope('projects')}
            >
              Solo proyectos
            </button>

            <div className="fb-menu-sep" />
            <div className="fb-menu-label">Rango de fechas</div>
            <div className="fb-menu-grid">
              <label className="fb-menu-inline">
                <span>Desde</span>
                <input type="date" value={dateFrom} onWheel={blockWheel} onChange={(e) => onDateFrom(e.target.value)} />
              </label>
              <label className="fb-menu-inline">
                <span>Hasta</span>
                <input type="date" value={dateTo} onWheel={blockWheel} onChange={(e) => onDateTo(e.target.value)} />
              </label>
            </div>

            <div className="fb-menu-actions">
              <button type="button" className="btn btn-ghost btn-sm" onClick={close}>Cerrar</button>
            </div>
          </div>
        )}
      </div>

      {/* Chips activos en línea (los que destacan visualmente) */}
      {responsibleName && (
        <button
          type="button"
          className="chip is-on fb-active-chip"
          onClick={() => onResponsibleFilter(null)}
          title={`Quitar filtro Responsable: ${responsibleName}`}
        >
          Resp: {responsibleName} <span className="fb-chip-x" aria-hidden="true">×</span>
        </button>
      )}
      {assigneeName && (
        <button
          type="button"
          className="chip is-on fb-active-chip"
          onClick={() => onAssigneeFilter(null)}
          title={`Quitar filtro Ejecutor: ${assigneeName}`}
        >
          Asig: {assigneeName} <span className="fb-chip-x" aria-hidden="true">×</span>
        </button>
      )}
      {projectName && (
        <button
          type="button"
          className="chip is-on fb-active-chip"
          onClick={() => onProjectFilter(null)}
          title={`Quitar filtro Proyecto: ${projectName}`}
        >
          {projectName} <span className="fb-chip-x" aria-hidden="true">×</span>
        </button>
      )}
      {teamName && onTeamFilter && (
        <button
          type="button"
          className="chip is-on fb-active-chip"
          onClick={() => onTeamFilter(null)}
          title={`Quitar filtro Equipo: ${teamName}`}
        >
          Equipo: {teamName} <span className="fb-chip-x" aria-hidden="true">×</span>
        </button>
      )}
      {matchScope === 'projects' && (
        <button
          type="button"
          className="chip is-on fb-active-chip"
          onClick={() => onMatchScope('all')}
          title="Aplicar filtros a todos los niveles"
        >
          Solo proyectos <span className="fb-chip-x" aria-hidden="true">×</span>
        </button>
      )}

      <div className="fb-spacer" />

      {activeCount > 0 && (
        <span className="fb-badge">{activeCount} {activeCount === 1 ? 'filtro activo' : 'filtros activos'}</span>
      )}
      <button
        type="button"
        className={'fb-clear' + (!hasActiveFilters ? ' is-idle' : '')}
        onClick={hasActiveFilters ? onClear : undefined}
        disabled={!hasActiveFilters}
      >
        Limpiar
      </button>
      <span className="fb-count">{totalVisible} ELEMENTOS</span>
    </div>
  );
}
