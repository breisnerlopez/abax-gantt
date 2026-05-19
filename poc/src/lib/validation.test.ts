import { describe, expect, it } from 'vitest';
import { canCreateDependency, canMoveNode, normalizeNodeDates, validateAttachment, validateDateRange, validateNodeInput } from './validation';

describe('validation', () => {
  it('rejects empty names', () => {
    expect(validateNodeInput({ name: ' ', type: 'task' }).ok).toBe(false);
  });

  it('rejects end date before start date', () => {
    expect(validateDateRange('2026-05-10', '2026-05-09')).toEqual({ ok: false, message: 'La fecha fin no puede ser menor que inicio.' });
  });

  it('normalizes milestone to one date', () => {
    expect(normalizeNodeDates('milestone', '2026-05-10', '2026-05-12')).toEqual({ start_date: '2026-05-10', end_date: '2026-05-10' });
  });

  it('allows task without dates for backlog', () => {
    expect(validateNodeInput({ name: 'Tarea sin fecha', type: 'task', start_date: null, end_date: null }).ok).toBe(true);
  });

  it('blocks invalid hierarchy moves', () => {
    expect(canMoveNode({ id: 'stage-1', type: 'stage' }, { id: 'task-1', type: 'task' }).ok).toBe(false);
    expect(canMoveNode({ id: 'stage-1', type: 'stage' }, { id: 'project-1', type: 'project' }).ok).toBe(true);
  });

  it('blocks duplicate and self dependencies', () => {
    expect(canCreateDependency('a', 'a', []).ok).toBe(false);
    expect(canCreateDependency('a', 'b', [{ id: 'd1', predecessor_id: 'a', successor_id: 'b', type: 'FS' }]).ok).toBe(false);
  });

  it('validates attachment size and file type', () => {
    expect(validateAttachment(new File(['ok'], 'plan.pdf', { type: 'application/pdf' })).ok).toBe(true);
    expect(validateAttachment(new File(['bad'], 'malware.exe', { type: 'application/x-msdownload' }))).toEqual({ ok: false, message: 'Tipo de archivo no permitido.' });
    expect(validateAttachment(new File([], 'empty.pdf', { type: 'application/pdf' }))).toEqual({ ok: false, message: 'El archivo está vacío.' });
  });
});
