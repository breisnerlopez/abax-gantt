import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTheme } from '../lib/theme';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { ShortcutsModal } from './ShortcutsModal';
import type { Summary } from '../lib/types';

interface AppShellProps {
  children: ReactNode;
  summary: Summary | null;
  userName: string;
  onLogout: () => void;
  onSearch?: (query: string) => void;
  onOpenAdmin?: () => void;
  /** V-13 fix: breadcrumb dinámico ('Vista consolidada', 'Administración', 'Proyecto: X'…) */
  breadcrumb?: string;
  /** Control on-demand del panel de detalle */
  detailVisible?: boolean;
  onToggleDetail?: () => void;
  fullscreen?: boolean;
}

const money = new Intl.NumberFormat('es-MX', { notation: 'compact', style: 'currency', currency: 'MXN' });

export function AppShell({ children, summary, userName, onLogout, onSearch, onOpenAdmin, breadcrumb, detailVisible, onToggleDetail, fullscreen }: AppShellProps) {
  const { theme, toggle } = useTheme();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 250);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  // Propaga al padre solo el valor debounceado, no en cada keystroke.
  useEffect(() => { onSearch?.(debouncedSearch); }, [debouncedSearch, onSearch]);

  // ⌘K / Ctrl+K: enfoca la busqueda global. Es el atajo prometido por el <kbd> del input.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isK = e.key === 'k' || e.key === 'K';
      if (!isK || !(e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
  // V-23: KPIs colapsados por defecto (línea compacta), expandibles a tarjetas grandes.
  // Estado persistido para respetar la preferencia del usuario.
  const [kpiExpanded, setKpiExpanded] = useState<boolean>(() => {
    try { return window.localStorage.getItem('abax.kpi.expanded') === '1'; }
    catch { return false; }
  });
  useEffect(() => {
    try { window.localStorage.setItem('abax.kpi.expanded', kpiExpanded ? '1' : '0'); } catch { /* ignore */ }
  }, [kpiExpanded]);

  // V-22: atajo "?" abre el modal de ayuda (no captura cuando se escribe en inputs)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== '?') return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return;
      e.preventDefault();
      setShortcutsOpen(true);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const kpis = [
    { label: 'Proyectos activos', value: String(summary?.active_projects ?? 0), sub: `de ${summary?.total_projects ?? 0} totales`, tone: 'blue' },
    { label: 'Avance global', value: `${summary?.global_progress ?? 0}%`, sub: 'ponderado', tone: 'green' },
    { label: 'Hitos próximos', value: String(summary?.upcoming_milestones_count ?? 0), sub: 'en 30 días', tone: 'violet' },
    { label: 'Tareas sin fecha', value: String(summary?.unscheduled_tasks ?? 0), sub: 'en backlog', tone: 'danger' },
    { label: 'Presupuesto', value: money.format(summary?.total_budget ?? 0), sub: `${summary?.budget_consumed_pct ?? 0}% usado`, tone: 'amber' },
  ];

  const handleSearch = (value: string) => {
    // Solo actualizamos el estado local; el debouncer se encarga del onSearch.
    setSearch(value);
  };

  return (
    <div className="app-shell">
      {!fullscreen && (
      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-mark">A</span>
          <strong>ABAX Gantt</strong>
        </div>
        <div className="workspace-crumb">
          <b>{breadcrumb ?? 'Vista consolidada'}</b>
        </div>
        <label className="global-search">
          <span className="sr-only">Búsqueda global</span>
          <input
            ref={searchInputRef}
            type="search"
            placeholder="Buscar tareas, proyectos, personas..."
            aria-label="Búsqueda global (atajo: Ctrl/Cmd + K)"
            aria-keyshortcuts="Control+K Meta+K"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
          <kbd aria-hidden="true">⌘K</kbd>
        </label>
        <button
          className="theme-toggle"
          onClick={toggle}
          title={`Cambiar a tema ${theme === 'light' ? 'oscuro' : 'claro'}`}
          aria-label={`Cambiar a tema ${theme === 'light' ? 'oscuro' : 'claro'}`}
        >
          {theme === 'light' ? '☽' : '☀'}
        </button>
        <button className="theme-toggle" onClick={() => setShortcutsOpen(true)} title="Atajos de teclado (?)" aria-label="Ver atajos de teclado">?</button>
        {onToggleDetail && (
          <button
            className={`theme-toggle ${detailVisible ? 'theme-toggle--active' : ''}`}
            onClick={onToggleDetail}
            title={detailVisible ? 'Ocultar panel de detalle' : 'Mostrar panel de detalle'}
            aria-label={detailVisible ? 'Ocultar panel' : 'Mostrar panel'}
            aria-pressed={detailVisible}
          >
            {detailVisible ? '◧' : '◨'}
          </button>
        )}
        <button className="ghost-button" onClick={onOpenAdmin}>Admin</button>
        <div className="user-chip">
          <span>{initials(userName)}</span>
          <b>{userName}</b>
        </div>
        <button className="ghost-button" onClick={onLogout}>Salir</button>
      </header>
      )}
      {!fullscreen && (
      <section
        className={`kpi-strip ${kpiExpanded ? 'kpi-strip--expanded' : ''}`}
        aria-label="Indicadores del portafolio"
      >
        {kpiExpanded ? (
          <div className="kpi-grid">
            {kpis.map((kpi) => (
              <article key={kpi.label} className={`kpi-widget kpi-widget--${kpi.tone}`}>
                <span>{kpi.label}</span>
                <div>
                  <strong>{kpi.value}</strong>
                  <em>{kpi.sub}</em>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="kpi-summary">
            {kpis.map((kpi, i) => (
              <span key={kpi.label} className={`kpi-pill kpi-pill--${kpi.tone}`}>
                <em>{kpi.label}</em>
                <strong>{kpi.value}</strong>
                {i < kpis.length - 1 && <span className="kpi-sep">·</span>}
              </span>
            ))}
          </div>
        )}
        <button
          className="kpi-toggle"
          onClick={() => setKpiExpanded((v) => !v)}
          aria-label={kpiExpanded ? 'Colapsar indicadores' : 'Expandir indicadores'}
          title={kpiExpanded ? 'Colapsar' : 'Ver detalle de indicadores'}
        >
          {kpiExpanded ? '▴' : '▾'}
        </button>
      </section>
      )}
      {children}
      <ShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  );
}

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}
