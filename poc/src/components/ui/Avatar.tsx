import type { HTMLAttributes } from 'react';

type Size = 'sm' | 'md' | 'lg';

export interface AvatarProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  name?: string | null;
  initials?: string;
  color?: string;
  size?: Size;
}

function deriveInitials(name?: string | null): string {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '??';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

const sizeClass: Record<Size, string> = {
  sm: 'avatar-sm',
  md: '',
  lg: 'avatar-lg',
};

export function Avatar({
  name,
  initials,
  color,
  size = 'md',
  className,
  style,
  title,
  ...rest
}: AvatarProps) {
  const cls = ['avatar', sizeClass[size], className].filter(Boolean).join(' ');
  const text = initials ?? deriveInitials(name);
  return (
    <div
      className={cls}
      style={{ ...(color ? { background: color } : null), ...style }}
      title={title ?? name ?? undefined}
      {...rest}
    >
      {text}
    </div>
  );
}

export type AvatarStackProps = HTMLAttributes<HTMLDivElement>;
export function AvatarStack({ className, children, ...rest }: AvatarStackProps) {
  return (
    <div className={['avatar-stack', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </div>
  );
}
