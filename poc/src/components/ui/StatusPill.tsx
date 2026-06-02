/**
 * StatusPill — sigue el sistema de "semáforo" del rediseño.
 * Acepta las claves castellanas del backend (pendiente / en_progreso /
 * completado / retrasado / cancelado / en_pausa / en_revision).
 */
import type { HTMLAttributes } from 'react';

const STATUS_LABELS: Record<string, string> = {
  pendiente: 'Pendiente',
  en_progreso: 'En progreso',
  completado: 'Completado',
  retrasado: 'Retrasado',
  cancelado: 'Cancelado',
  en_pausa: 'En pausa',
  en_revision: 'En revisión',
};

export interface StatusPillProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  status: string | null | undefined;
  label?: string;
}

export function StatusPill({ status, label, className, ...rest }: StatusPillProps) {
  const key = status ?? 'pendiente';
  const cls = ['status', key, className].filter(Boolean).join(' ');
  return (
    <span className={cls} {...rest}>
      <span className="status-dot" aria-hidden="true" />
      {label ?? STATUS_LABELS[key] ?? key}
    </span>
  );
}

export { STATUS_LABELS };
