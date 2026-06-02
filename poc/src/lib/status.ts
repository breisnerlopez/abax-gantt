/**
 * Estado de un nodo: derivación automática y vocabulario compartido.
 * Hasta el rediseño Fase 3 esta lógica vivía duplicada en GanttCanvas y
 * DetailPanel. Centralizada para que el FilterBar y la capa de datos la
 * usen sin re-implementarla.
 */
import type { WbsNode } from './types';

export const STATUS_LABELS: Record<string, string> = {
  pendiente: 'Pendiente',
  en_progreso: 'En progreso',
  completado: 'Completado',
  retrasado: 'Retrasado',
  cancelado: 'Cancelado',
  en_pausa: 'En pausa',
  en_revision: 'En revisión',
};

/** Estados que aparecen como pills "semáforo" en el FilterBar. Orden visual. */
export const STATUS_SEMAPHORE = ['pendiente', 'en_progreso', 'completado', 'retrasado'] as const;
export type SemaphoreStatus = (typeof STATUS_SEMAPHORE)[number];

/**
 * Estado resuelto de un nodo. Si node.status existe lo respeta tal cual
 * (estado manual); si no, lo deriva de avance + fechas.
 */
export function computeNodeStatus(node: WbsNode): string {
  if (node.status) return node.status;
  const today = new Date().toISOString().slice(0, 10);
  if ((node.progress ?? 0) >= 1) return 'completado';
  if (node.end_date && node.end_date < today) return 'retrasado';
  if ((node.progress ?? 0) > 0) return 'en_progreso';
  return 'pendiente';
}

/** Mapea el estado castellano a la clase del skin del Gantt (t-done…). */
export function statusToBarClass(status: string): 't-done' | 't-prog' | 't-late' | 't-pend' {
  if (status === 'completado') return 't-done';
  if (status === 'en_progreso') return 't-prog';
  if (status === 'retrasado') return 't-late';
  return 't-pend';
}
