import { useEffect, useRef, useState } from 'react';

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
  onCollapseAll: () => void;
  scale: 'Día' | 'Semana' | 'Mes' | 'Año';
  onScaleChange: (scale: 'Día' | 'Semana' | 'Mes' | 'Año') => void;
}

export function Toolbar({
  selectedName, onCreateProject, onCreateChild, canEditStructure,
  onExport, onMyTasks, myTasks, onFocusProject, focusProjectName, onToday, onCollapseAll, scale, onScaleChange,
}: ToolbarProps) {
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!exportOpen) return;
    const close = (e: MouseEvent) => {
      if (!exportRef.current?.contains(e.target as Node)) setExportOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [exportOpen]);

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
      <button onClick={onCollapseAll} title="Colapsar todos los proyectos">⊟ Colapsar</button>
      {focusProjectName ? (
        <button className="primary-button" onClick={onFocusProject}>← Volver a portafolio</button>
      ) : (
        <button onClick={onFocusProject} disabled={!selectedName}>Enfocar proyecto</button>
      )}
      <span className="toolbar-spacer" />
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
