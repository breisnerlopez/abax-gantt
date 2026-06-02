import { useEffect, useRef, useState } from 'react';
import { GRID_COLUMN_LABELS, GRID_COLUMN_ORDER, type GridColumnsConfig } from '../lib/grid-columns';
import type { GroupBy } from '../lib/grouping';

interface ToolbarProps {
  totalNodes: number;
  selectedName: string | null;
  onCreateProject: () => void;
  onCreateChild: () => void;
  canEditStructure: boolean;
  onExport: (format: 'json' | 'csv' | 'html' | 'png') => void;
  onMyTasks: () => void;
  myTasks: boolean;
  onFocusProject: () => void;
  focusProjectName: string | null;
  onToday: () => void;
  scale: 'Día' | 'Semana' | 'Mes' | 'Año';
  onScaleChange: (scale: 'Día' | 'Semana' | 'Mes' | 'Año') => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  gridColumns: GridColumnsConfig;
  onToggleGridColumn: (key: keyof GridColumnsConfig, value: boolean) => void;
  onResetGridColumns: () => void;
  groupBy: GroupBy;
  onGroupByChange: (g: GroupBy) => void;
  /** Fase 9: la opción "Equipo" sólo se habilita si el backend devolvió equipos. */
  teamsAvailable?: boolean;
}

export function Toolbar({
  selectedName, onCreateProject, onCreateChild, canEditStructure,
  onExport, onMyTasks, myTasks, onFocusProject, focusProjectName, onToday, scale, onScaleChange,
  isFullscreen, onToggleFullscreen,
  gridColumns, onToggleGridColumn, onResetGridColumns,
  groupBy, onGroupByChange, teamsAvailable = false,
}: ToolbarProps) {
  const [exportOpen, setExportOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const columnsRef = useRef<HTMLDivElement>(null);
  const groupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!exportOpen) return;
    const close = (e: MouseEvent) => {
      if (!exportRef.current?.contains(e.target as Node)) setExportOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [exportOpen]);

  useEffect(() => {
    if (!columnsOpen) return;
    const close = (e: MouseEvent) => {
      if (!columnsRef.current?.contains(e.target as Node)) setColumnsOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setColumnsOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [columnsOpen]);

  useEffect(() => {
    if (!groupOpen) return;
    const close = (e: MouseEvent) => {
      if (!groupRef.current?.contains(e.target as Node)) setGroupOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setGroupOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [groupOpen]);

  const visibleCount = Object.values(gridColumns).filter(Boolean).length;

  return (
    <div className="toolbar">
      <button className="primary-button" onClick={onCreateProject} disabled={!canEditStructure}>
        + Proyecto <kbd>⌘⇧N</kbd>
      </button>
      <button onClick={onCreateChild} disabled={!selectedName || !canEditStructure}>+ Nodo hijo</button>
      <span className="divider" />
      <button onClick={onToday} title="Centrar en hoy">Hoy</button>
      <div className="scale-switch" aria-label="Escala del Gantt">
        {(['Día', 'Semana', 'Mes', 'Año'] as const).map((item) => (
          <button key={item} className={scale === item ? 'primary-button' : ''} onClick={() => onScaleChange(item)}>
            {item}
          </button>
        ))}
      </div>
      <button className={myTasks ? 'primary-button' : ''} onClick={onMyTasks}>Mis tareas</button>
      {focusProjectName ? (
        <button className="primary-button" onClick={onFocusProject}>← Volver a portafolio</button>
      ) : (
        <button onClick={onFocusProject} disabled={!selectedName}>Enfocar proyecto</button>
      )}
      <span className="toolbar-spacer" />
      <button onClick={onToggleFullscreen} title={isFullscreen ? 'Salir de pantalla completa' : 'Maximizar Gantt'}>
        {isFullscreen ? '⛶ Salir' : '⛶ Pantalla completa'}
      </button>
      <div className="group-menu" ref={groupRef}>
        <button
          type="button"
          className={'tb-columns-btn' + (groupOpen ? ' is-open' : '') + (groupBy !== 'none' ? ' is-active' : '')}
          onClick={() => setGroupOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={groupOpen}
          title="Agrupar por"
        >
          Agrupar: {groupBy === 'responsible' ? 'Responsable' : groupBy === 'team' ? 'Equipo' : 'No'} <span aria-hidden="true">▾</span>
        </button>
        {groupOpen && (
          <div className="columns-menu-popover fb-menu" role="menu" aria-label="Agrupar por">
            <div className="fb-menu-label">Agrupar proyectos por</div>
            <button
              type="button"
              role="menuitemradio"
              aria-checked={groupBy === 'none'}
              className={'fb-menu-item' + (groupBy === 'none' ? ' is-on' : '')}
              onClick={() => { onGroupByChange('none'); setGroupOpen(false); }}
            >
              Sin agrupar
            </button>
            <button
              type="button"
              role="menuitemradio"
              aria-checked={groupBy === 'responsible'}
              className={'fb-menu-item' + (groupBy === 'responsible' ? ' is-on' : '')}
              onClick={() => { onGroupByChange('responsible'); setGroupOpen(false); }}
            >
              Responsable
            </button>
            <div className="fb-menu-sep" />
            <button
              type="button"
              role="menuitemradio"
              aria-checked={groupBy === 'team'}
              className={'fb-menu-item' + (groupBy === 'team' ? ' is-on' : '')}
              onClick={() => { onGroupByChange('team'); setGroupOpen(false); }}
              disabled={!teamsAvailable}
              title={teamsAvailable ? 'Agrupar por equipo' : 'No hay equipos creados aún (créalos desde Admin)'}
              style={!teamsAvailable ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
            >
              Equipo{!teamsAvailable ? ' (sin equipos)' : ''}
            </button>
          </div>
        )}
      </div>
      <div className="columns-menu" ref={columnsRef}>
        <button
          type="button"
          className={'tb-columns-btn' + (columnsOpen ? ' is-open' : '')}
          onClick={() => setColumnsOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={columnsOpen}
          title="Columnas visibles del grid"
        >
          Columnas <span aria-hidden="true">▾</span>
        </button>
        {columnsOpen && (
          <div className="columns-menu-popover fb-menu" role="menu" aria-label="Configurar columnas">
            <div className="fb-menu-label">Columnas visibles</div>
            {GRID_COLUMN_ORDER.map((key) => (
              <button
                key={key}
                type="button"
                role="menuitemcheckbox"
                aria-checked={gridColumns[key]}
                className={'fb-menu-item fb-toggle' + (gridColumns[key] ? ' is-on' : '')}
                onClick={() => onToggleGridColumn(key, !gridColumns[key])}
              >
                <span>{GRID_COLUMN_LABELS[key]}</span>
                <span className="fb-toggle-mark" aria-hidden="true" />
              </button>
            ))}
            <div className="fb-menu-sep" />
            <div className="fb-menu-actions">
              <span className="tb-columns-count" aria-live="polite">
                {visibleCount} de {GRID_COLUMN_ORDER.length}
              </span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { onResetGridColumns(); }}>
                Restablecer
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="export-menu" ref={exportRef}>
        <button onClick={() => setExportOpen((v) => !v)} aria-haspopup="menu" aria-expanded={exportOpen}>
          Exportar ▾
        </button>
        {exportOpen && (
          <div className="export-menu-popover" role="menu">
            <button role="menuitem" onClick={() => { onExport('png'); setExportOpen(false); }}>Imagen (PNG)</button>
            <button role="menuitem" onClick={() => { onExport('html'); setExportOpen(false); }}>HTML imprimible</button>
            <button role="menuitem" onClick={() => { onExport('csv'); setExportOpen(false); }}>CSV</button>
            <button role="menuitem" onClick={() => { onExport('json'); setExportOpen(false); }}>JSON</button>
          </div>
        )}
      </div>
    </div>
  );
}
