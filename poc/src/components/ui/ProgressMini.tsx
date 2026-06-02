/**
 * ProgressMini — barrita + porcentaje. Tono según estado.
 */
import type { HTMLAttributes } from 'react';

export interface ProgressMiniProps extends HTMLAttributes<HTMLDivElement> {
  value: number;
  status?: 'completado' | 'en_progreso' | 'retrasado' | 'pendiente' | string | null;
  hideLabel?: boolean;
}

function fillVariant(status?: string | null): string {
  if (status === 'completado') return 'done';
  if (status === 'retrasado') return 'late';
  return '';
}

export function ProgressMini({ value, status, hideLabel, className, ...rest }: ProgressMiniProps) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const variant = fillVariant(status);
  const cls = ['pct-mini', className].filter(Boolean).join(' ');
  return (
    <div className={cls} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} {...rest}>
      <div className="pct-bar">
        <div className={['pct-fill', variant].filter(Boolean).join(' ')} style={{ width: `${pct}%` }} />
      </div>
      {!hideLabel ? <span className="pct-label">{pct}%</span> : null}
    </div>
  );
}
