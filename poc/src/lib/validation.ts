import type { Dependency, NodeType, WbsNode } from './types';

export interface ValidationResult {
  ok: boolean;
  message?: string;
}

export function isValidNodeName(name: string): ValidationResult {
  return name.trim().length > 0 ? { ok: true } : { ok: false, message: 'El nombre es obligatorio.' };
}

export function validateDateRange(startDate: string | null | undefined, endDate: string | null | undefined): ValidationResult {
  if (!startDate || !endDate) return { ok: true };
  return endDate >= startDate ? { ok: true } : { ok: false, message: 'La fecha fin no puede ser menor que inicio.' };
}

export function normalizeNodeDates(type: NodeType, startDate: string | null, endDate: string | null) {
  if (!startDate) return { start_date: null, end_date: null };
  if (type === 'milestone') return { start_date: startDate, end_date: startDate };
  return { start_date: startDate, end_date: endDate || startDate };
}

export function validateNodeInput(input: { name: string; type: NodeType; start_date?: string | null; end_date?: string | null }): ValidationResult {
  const name = isValidNodeName(input.name);
  if (!name.ok) return name;
  const dates = normalizeNodeDates(input.type, input.start_date ?? null, input.end_date ?? null);
  return validateDateRange(dates.start_date, dates.end_date);
}

export function canMoveNode(node: Pick<WbsNode, 'id' | 'type'>, newParent: Pick<WbsNode, 'id' | 'type'> | null): ValidationResult {
  if (node.type === 'project') {
    return newParent === null ? { ok: true } : { ok: false, message: 'Un proyecto debe permanecer como nodo raíz.' };
  }
  if (!newParent) return { ok: false, message: 'Solo los proyectos pueden vivir en la raíz.' };
  if (node.id === newParent.id) return { ok: false, message: 'Un nodo no puede moverse debajo de sí mismo.' };

  const parentType = newParent.type;
  const allowed: Record<NodeType, NodeType[]> = {
    project: [],
    stage: ['project'],
    group: ['stage', 'group'],
    task: ['project', 'stage', 'group', 'task'],
    milestone: ['project', 'stage', 'group'],
  };

  return allowed[node.type].includes(parentType)
    ? { ok: true }
    : { ok: false, message: `${label(node.type)} no puede moverse debajo de ${label(parentType)}.` };
}

export function canCreateDependency(sourceId: string, targetId: string, dependencies: Dependency[]): ValidationResult {
  if (sourceId === targetId) return { ok: false, message: 'Una tarea no puede depender de sí misma.' };
  const duplicate = dependencies.some((dependency) => dependency.predecessor_id === sourceId && dependency.successor_id === targetId);
  return duplicate ? { ok: false, message: 'La dependencia ya existe.' } : { ok: true };
}

export function validateAttachment(file: File): ValidationResult {
  if (file.size === 0) return { ok: false, message: 'El archivo está vacío.' };
  if (file.size > 5 * 1024 * 1024) return { ok: false, message: 'El archivo excede 5 MB.' };
  if (!isAllowedAttachment(file)) return { ok: false, message: 'Tipo de archivo no permitido.' };
  return { ok: true };
}

const allowedAttachmentTypes = new Set([
  'application/pdf',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/csv',
  'application/zip',
]);

const allowedAttachmentExtensions = new Set(['.pdf', '.xls', '.xlsx', '.doc', '.docx', '.txt', '.csv', '.zip', '.png', '.jpg', '.jpeg', '.webp']);

function isAllowedAttachment(file: File) {
  if (file.type.startsWith('image/')) return true;
  if (allowedAttachmentTypes.has(file.type)) return true;
  const lowerName = file.name.toLowerCase();
  return [...allowedAttachmentExtensions].some((extension) => lowerName.endsWith(extension));
}

function label(type: NodeType) {
  const labels: Record<NodeType, string> = { project: 'Proyecto', stage: 'Etapa', group: 'Grupo', task: 'Tarea', milestone: 'Hito' };
  return labels[type];
}
