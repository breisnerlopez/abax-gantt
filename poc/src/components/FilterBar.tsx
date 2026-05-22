import { useState } from 'react';
import { SearchableSelect } from './SearchableSelect';
import type { NodeType } from '../lib/types';

interface FilterBarProps {
  search: string;
  onSearch: (query: string) => void;
  typeFilter: NodeType | null;
  onTypeFilter: (type: NodeType | null) => void;
  showUnscheduled: boolean;
  onShowUnscheduled: (show: boolean) => void;
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
  projectFilter, onProjectFilter, projectOptions,
  responsibleFilter, onResponsibleFilter,
  assigneeFilter, onAssigneeFilter,
  statusFilter, onStatusFilter,
  dateFrom, onDateFrom, dateTo, onDateTo,
  activeOnly, onActiveOnly,
  totalVisible, hasActiveFilters, onClear, users,
}: FilterBarProps) {
  const filters: string[] = [];
  const projectName = projectFilter ? (projectOptions.find((p) => p.id === projectFilter)?.name ?? projectFilter) : null;
  const responsibleName = responsibleFilter ? (users.find((u) => u.id === responsibleFilter)?.full_name ?? 'Usuario') : null;
  const assigneeName = assigneeFilter ? (users.find((u) => u.id === assigneeFilter)?.full_name ?? 'Usuario') : null;

  if (search) filters.push(`Buscar: "${search}"`);
  if (typeFilter) filters.push(`Tipo: ${nodeTypeLabels[typeFilter]}`);
  if (showUnscheduled) filters.push('Solo backlog');
  if (projectName) filters.push(projectName);
  if (responsibleName) filters.push(`Resp: ${responsibleName}`);
  if (assigneeName) filters.push(`Asig: ${assigneeName}`);
  if (statusFilter) filters.push(statusLabels[statusFilter] ?? statusFilter);

  // Esencial siempre visible. El resto se oculta detrás de "Más filtros".
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = !!(projectFilter || responsibleFilter || assigneeFilter || statusFilter || dateFrom || dateTo);

  return (
    <div className="filter-bar">
      <input
        className="filter-search filter-search--main"
        type="search"
        placeholder="Filtrar por nombre…"
        value={search}
        onChange={(e) => onSearch(e.target.value)}
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
        className={`filter-more ${moreActive ? 'is-active' : ''}`}
        onClick={() => setMoreOpen((v) => !v)}
        aria-expanded={moreOpen}
      >
        Más filtros {moreActive ? '●' : '▾'}
      </button>
      {filters.length > 0 && (
        <div className="filter-chips-row">
          {filters.map((f) => <span key={f} className="filter-chip">{f}</span>)}
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
              onChange={(id) => onProjectFilter(id)}
            />
          </label>
          <label>
            <span>Responsable</span>
            <SearchableSelect
              value={responsibleFilter ?? ''}
              options={users.map((u) => ({ id: u.id, label: u.full_name ?? u.email ?? u.id }))}
              placeholder="Cualquiera"
              onChange={(id) => onResponsibleFilter(id)}
            />
          </label>
          <label>
            <span>Ejecutor</span>
            <SearchableSelect
              value={assigneeFilter ?? ''}
              options={users.map((u) => ({ id: u.id, label: u.full_name ?? u.email ?? u.id }))}
              placeholder="Cualquiera"
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
