/**
 * Columnas configurables de la grilla del Gantt (handoff §5.4).
 *
 * El usuario controla qué columnas son visibles desde el menú "Columnas"
 * del Toolbar. El nombre es siempre visible (no se puede ocultar).
 * Default: Estado + Responsable visibles; Inicio/Días/% a demanda (la
 * grilla pasa de ~25% a ~16% del ancho útil).
 */

export type GridColumnKey = 'start_date' | 'duration' | 'progress' | 'status' | 'responsible';

export interface GridColumnsConfig {
  start_date: boolean;
  duration: boolean;
  progress: boolean;
  status: boolean;
  responsible: boolean;
}

export const DEFAULT_GRID_COLUMNS: GridColumnsConfig = {
  start_date: false,
  duration: false,
  progress: false,
  status: true,
  responsible: true,
};

export const GRID_COLUMN_LABELS: Record<GridColumnKey, string> = {
  start_date: 'Inicio',
  duration: 'Días',
  progress: '%',
  status: 'Estado',
  responsible: 'Responsable',
};

export const GRID_COLUMN_ORDER: GridColumnKey[] = ['start_date', 'duration', 'progress', 'status', 'responsible'];

const STORAGE_KEY = 'abax.columns';

export function loadGridColumns(): GridColumnsConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_GRID_COLUMNS };
    const parsed = JSON.parse(raw) as Partial<GridColumnsConfig>;
    return { ...DEFAULT_GRID_COLUMNS, ...parsed };
  } catch {
    return { ...DEFAULT_GRID_COLUMNS };
  }
}

export function saveGridColumns(cfg: GridColumnsConfig): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg)); } catch { /* ignore */ }
}
