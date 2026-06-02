/**
 * Field — wrapper para input/select con label + hint opcional.
 * Sólo layout: el control se pasa como children y conserva su estilo.
 */
import { useId, type HTMLAttributes, type ReactNode } from 'react';

export interface FieldProps extends HTMLAttributes<HTMLDivElement> {
  label?: ReactNode;
  hint?: ReactNode;
  htmlFor?: string;
  children: ReactNode;
}

export function Field({ label, hint, htmlFor, className, children, ...rest }: FieldProps) {
  const generated = useId();
  const id = htmlFor ?? generated;
  const cls = ['field', className].filter(Boolean).join(' ');
  return (
    <div className={cls} {...rest}>
      {label ? <label className="field-label" htmlFor={id}>{label}</label> : null}
      {children}
      {hint ? <div className="field-hint">{hint}</div> : null}
    </div>
  );
}
