import type { ButtonHTMLAttributes, MouseEvent, ReactNode } from 'react';

export interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  active?: boolean;
  removable?: boolean;
  onRemove?: () => void;
  children?: ReactNode;
}

export function Chip({
  active,
  removable,
  onRemove,
  className,
  children,
  type = 'button',
  ...rest
}: ChipProps) {
  const cls = ['chip', active ? 'is-on' : '', className].filter(Boolean).join(' ');
  const handleRemove = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onRemove?.();
  };
  return (
    <button type={type} className={cls} {...rest}>
      {children}
      {removable ? (
        <button
          type="button"
          className="chip-remove"
          onClick={handleRemove}
          aria-label="Quitar"
        >
          ×
        </button>
      ) : null}
    </button>
  );
}
