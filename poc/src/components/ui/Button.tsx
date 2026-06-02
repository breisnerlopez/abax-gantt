import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'default' | 'primary' | 'ghost' | 'danger';
type Size = 'md' | 'sm';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  kbd?: string;
}

const variantClass: Record<Variant, string> = {
  default: '',
  primary: 'btn-primary',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
};

export function Button({
  variant = 'default',
  size = 'md',
  leadingIcon,
  trailingIcon,
  kbd,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  const cls = ['btn', variantClass[variant], size === 'sm' ? 'btn-sm' : '', className]
    .filter(Boolean)
    .join(' ');
  return (
    <button type={type} className={cls} {...rest}>
      {leadingIcon}
      {children}
      {trailingIcon}
      {kbd ? <span className="kbd">{kbd}</span> : null}
    </button>
  );
}
