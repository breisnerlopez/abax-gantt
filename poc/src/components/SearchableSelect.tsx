import { useEffect, useRef, useState } from 'react';

interface SearchableSelectProps {
  value: string;
  options: Array<{ id: string; label: string }>;
  placeholder?: string;
  onChange: (id: string | null) => void;
  /** Etiqueta accesible para lectores de pantalla. Sin esto, el input solo se
   * anuncia como "edit" sin contexto. */
  ariaLabel?: string;
}

export function SearchableSelect({ value, options, placeholder = 'Buscar...', onChange, ariaLabel }: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.id === value);
  const filtered = query
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  const displayValue = open ? query : (selected?.label ?? '');
  const placeholderText = selected ? '' : placeholder;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const handleOpen = () => {
    setQuery('');
    setOpen(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  return (
    <div className="searchable-select" ref={containerRef}>
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-label={ariaLabel ?? placeholder}
        placeholder={placeholderText}
        value={displayValue}
        onFocus={handleOpen}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur(); }
        }}
      />
      {open && (
        <ul className="searchable-select__options" role="listbox">
          {value && (
            <li role="option" aria-selected={false} onClick={() => { onChange(null); setOpen(false); }}>
              — Sin selección —
            </li>
          )}
          {filtered.map((opt) => (
            <li
              key={opt.id}
              role="option"
              aria-selected={value === opt.id}
              onClick={() => { onChange(opt.id); setOpen(false); }}
            >
              {opt.label}
            </li>
          ))}
          {filtered.length === 0 && <li className="searchable-select__empty">Sin resultados</li>}
        </ul>
      )}
    </div>
  );
}
