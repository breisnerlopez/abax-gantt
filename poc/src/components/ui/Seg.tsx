/**
 * Seg — segmented control. Una opción activa entre N.
 */
import type { Key } from 'react';

export interface SegOption<V extends Key> {
  value: V;
  label: string;
  disabled?: boolean;
}

export interface SegProps<V extends Key> {
  options: ReadonlyArray<SegOption<V>>;
  value: V;
  onChange: (value: V) => void;
  className?: string;
  ariaLabel?: string;
}

export function Seg<V extends Key>({ options, value, onChange, className, ariaLabel }: SegProps<V>) {
  const cls = ['seg', className].filter(Boolean).join(' ');
  return (
    <div className={cls} role="tablist" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={o.value === value}
          disabled={o.disabled}
          className={o.value === value ? 'is-on' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
