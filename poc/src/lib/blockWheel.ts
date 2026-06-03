/**
 * Helper para inputs nativos cuya rueda del ratón es destructiva:
 * - `<input type="date">` (Chrome/Firefox cambian la fecha al rotar)
 * - `<input type="number">` (idem, decrementan/incrementan el valor)
 * - `<select>` (rotar cambia la opción seleccionada)
 *
 * Al recibir wheel sobre estos controles, hacemos blur() inmediato. El
 * navegador procesa el blur antes de aplicar el cambio, así el valor no
 * se modifica y la rueda pasa al contenedor padre como scroll normal.
 *
 * Uso: `<input type="date" onWheel={blockWheel} ... />`
 */
import type { WheelEvent } from 'react';

export function blockWheel(event: WheelEvent<HTMLInputElement | HTMLSelectElement>): void {
  // Si el control ya está focuseado activamente, el usuario probablemente
  // QUIERE rotar (caso poco habitual pero respeta la intención): no hacemos nada.
  if (document.activeElement === event.currentTarget) return;
  event.currentTarget.blur();
}
