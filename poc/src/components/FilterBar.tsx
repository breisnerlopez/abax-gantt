import { useEffect, useState } from 'react';
import { SearchableSelect } from './SearchableSelect';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import type { NodeType } from '../lib/types';

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
const statusOptions = ['pendiente', 'en_progreso', 'completado', 'retrasado'] as const;
const statusLabels: Record<string, string> = { pendiente: 'Pendiente', en_progreso: 'En progreso', completado: 'Completado', retrasado: 'Retrasado' };

export function FilterBar({
  search, onSearch, typeFilter, onTypeFilter, showUnscheduled, onShowUnscheduled,
  showBacklogInGantt, onShowBacklogInGantt,
  projectFilter, onProjectFilter, projectOptions,
  responsibleFilter, onResponsibleFilter,
  assigneeFilter, onAssigneeFilter,
  statusFilter, onStatusFilter,
  dateFrom, onDateFrom, dateTo, onDateTo,
  activeOnly, onActiveOnly,
  totalVisible, hasActiveFilters, onClear, users,
}: FilterBarProps) {
  // Debounce: la busqueda escribe en estado local y solo llama onSearch tras 250ms
  // de inactividad. Evita filtrar 1700+ nodos en cada keystroke.
  const [searchLocal, setSearchLocal] = useState(search);
  const debouncedSearch = useDebouncedValue(searchLocal, 250);
  useEffect(() => { if (debouncedSearch !== search) onSearch(debouncedSearch); }, [debouncedSearch, search, onSearch]);
  // Si el padre limpia los filtros, sincronizamos el input local.
  useEffect(() => { if (search !== searchLocal && search === '') setSearchLocal(''); }, [search, searchLocal]);

  const projectName = projectFilter ? (projectOptions.find((p) => p.id === projectFilter)?.name ?? projectFilter) : null;
  const responsibleName = responsibleFilter ? (users.find((u) => u.id === responsibleFilter)?.full_name ?? 'Usuario') : null;
  const assigneeName = assigneeFilter ? (users.find((u) => u.id === assigneeFilter)?.full_name ?? 'Usuario') : null;

  // Cada chip es removible: label + handler que limpia ese filtro especifico.
  const activeFilters: Array<{ key: string; label: string; clear: () => void }> = [];
  if (search) activeFilters.push({ key: 'search', label: `Buscar: "${search}"`, clear: () => { setSearchLocal(''); onSearch(''); } });
  if (typeFilter) activeFilters.push({ key: 'type', label: `Tipo: ${nodeTypeLabels[typeFilter]}`, clear: () => onTypeFilter(null) });
  if (showUnscheduled) activeFilters.push({ key: 'unsched', label: 'Solo backlog', clear: () => onShowUnscheduled(false) });
  if (projectName) activeFilters.push({ key: 'project', label: projectName, clear: () => onProjectFilter(null) });
  if (responsibleName) activeFilters.push({ key: 'resp', label: `Resp: ${responsibleName}`, clear: () => onResponsibleFilter(null) });
  if (assigneeName) activeFilters.push({ key: 'asig', label: `Asig: ${assigneeName}`, clear: () => onAssigneeFilter(null) });
  if (statusFilter) activeFilters.push({ key: 'status', label: statusLabels[statusFilter] ?? statusFilter, clear: () => onStatusFilter(null) });
  if (dateFrom) activeFilters.push({ key: 'from', label: `Desde ${dateFrom}`, clear: () => onDateFrom('') });
  if (dateTo) activeFilters.push({ key: 'to', label: `Hasta ${dateTo}`, clear: () => onDateTo('') });

  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = !!(projectFilter || responsibleFilter || assigneeFilter || statusFilter || dateFrom || dateTo);
  const advancedCount = [projectFilter, responsibleFilter, assigneeFilter, statusFilter, dateFrom && dateFrom, dateTo && dateTo].filter(Boolean).length;

  return (
    <div className="filter-bar">
      <input
        className="filter-search filter-search--main"
        type="search"
        placeholder="Filtrar por nombre…"
        aria-label="Filtrar nodos por nombre"
        value={searchLocal}
        onChange={(e) => setSearchLocal(e.target.value)}
      />
      {nodeTypes.map((type) => (
        <button
          key={type}
          className={`filter-chip-btn ${typeFilter === type ? 'is-active' : ''}`}
          onClick={() => onTypeFilter(typeFilter === type ? null : type)}
        >
          {nodeTypeLabels[type]}
        </button>
      ))}
      <button
        className={`filter-chip-btn ${showUnscheduled ? 'is-active' : ''}`}
        onClick={() => onShowUnscheduled(!showUnscheduled)}
      >
        Solo backlog
      </button>
      <button
        className={`filter-chip-btn ${activeOnly ? 'is-active' : ''}`}
        onClick={() => onActiveOnly(!activeOnly)}
      >
        Ocultar cerrados
      </button>
      <button
        className={`filter-chip-btn ${showBacklogInGantt ? 'is-active' : ''}`}
        onClick={() => onShowBacklogInGantt(!showBacklogInGantt)}
        title="Mostrar tareas del backlog como barras grises en el Gantt"
      >
        Backlog visible
      </button>
      <button
        className={`filter-more ${moreActive ? 'is-active' : ''}`}
        onClick={() => setMoreOpen((v) => !v)}
        aria-expanded={moreOpen}
      >
        Más filtros {moreActive ? `(${advancedCount})` : '▾'}
      </button>
      {activeFilters.length > 0 && (
        <div className="filter-chips-row" role="list" aria-label="Filtros activos">
          {activeFilters.map((f) => (
            <span key={f.key} className="filter-chip" role="listitem">
              {f.label}
              <button
                type="button"
                className="filter-chip-remove"
                aria-label={`Quitar filtro: ${f.label}`}
                onClick={f.clear}
              >×</button>
            </span>
          ))}
        </div>
      )}
      <button className={`clear-button${!hasActiveFilters ? ' clear-button--idle' : ''}`} onClick={hasActiveFilters ? onClear : undefined} disabled={!hasActiveFilters}>Limpiar</button>
      <span className="filter-count">{totalVisible} elementos</span>

      {moreOpen && (
        <div className="filter-more-popover" role="region" aria-label="Filtros avanzados">
          <label>
            <span>Proyecto</span>
            <SearchableSelect
              value={projectFilter ?? ''}
              options={projectOptions.map((p) => ({ id: p.id, label: p.name }))}
              placeholder="Todos"
              ariaLabel="Filtrar por proyecto"
              onChange={(id) => onProjectFilter(id)}
            />
          </label>
          <label>
            <span>Responsable</span>
            <SearchableSelect
              value={responsibleFilter ?? ''}
              options={users.map((u) => ({ id: u.id, label: u.full_name ?? u.email ?? u.id }))}
              placeholder="Cualquiera"
              ariaLabel="Filtrar por responsable"
              onChange={(id) => onResponsibleFilter(id)}
            />
          </label>
          <label>
            <span>Ejecutor</span>
            <SearchableSelect
              value={assigneeFilter ?? ''}
              options={users.map((u) => ({ id: u.id, label: u.full_name ?? u.email ?? u.id }))}
              placeholder="Cualquiera"
              ariaLabel="Filtrar por ejecutor"
              onChange={(id) => onAssigneeFilter(id)}
            />
          </label>
          <label>
            <span>Estado</span>
            <select value={statusFilter ?? ''} onChange={(e) => onStatusFilter(e.target.value || null)}>
              <option value="">Todos</option>
              {statusOptions.map((s) => <option key={s} value={s}>{statusLabels[s]}</option>)}
            </select>
          </label>
          <label>
            <span>Desde</span>
            <input type="date" value={dateFrom} onChange={(e) => onDateFrom(e.target.value)} />
          </label>
          <label>
            <span>Hasta</span>
            <input type="date" value={dateTo} onChange={(e) => onDateTo(e.target.value)} />
          </label>
          <div className="filter-more-actions">
            <button onClick={() => setMoreOpen(false)}>Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}
