import { useEffect, useState } from 'react';

// Devuelve `value` con un delay de `delayMs`. Si `value` cambia antes de
// que pase el delay, se reinicia el timer. Lo usamos para que la busqueda
// no dispare filtros pesados en cada keystroke.
export function useDebouncedValue<T>(value: T, delayMs = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}
