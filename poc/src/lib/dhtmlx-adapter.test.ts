import { describe, expect, it } from 'vitest';
import { toGanttData } from './dhtmlx-adapter';
import { makeDependency, makeNode } from './test-fixtures';

describe('toGanttData', () => {
  it('converts scheduled nodes and excludes backlog nodes', () => {
    const project = makeNode({ id: 'project-1', type: 'project', name: 'Proyecto', parent_id: null });
    const task = makeNode({ id: 'task-1', parent_id: 'project-1', name: 'Tarea' });
    const backlog = makeNode({ id: 'backlog-1', is_unscheduled: true, start_date: null, end_date: null });

    const result = toGanttData([project, task, backlog], []);

    expect(result.data.map((item) => item.id)).toEqual(['project-1', 'task-1']);
    expect(result.data.find((item) => item.id === 'task-1')?.parent).toBe('project-1');
  });

  it('maps dependency types and skips links to unscheduled nodes', () => {
    const a = makeNode({ id: 'a' });
    const b = makeNode({ id: 'b' });
    const backlog = makeNode({ id: 'c', is_unscheduled: true, start_date: null });

    const result = toGanttData([
      a,
      b,
      backlog,
    ], [makeDependency({ id: 'dep-ss', predecessor_id: 'a', successor_id: 'b', type: 'SS' }), makeDependency({ id: 'dep-hidden', predecessor_id: 'a', successor_id: 'c' })]);

    expect(result.links).toEqual([{ id: 'dep-ss', source: 'a', target: 'b', type: '1' }]);
  });

  it('sets milestone duration to zero', () => {
    const result = toGanttData([makeNode({ id: 'milestone-1', type: 'milestone' })], []);
    expect(result.data[0]?.duration).toBe(0);
  });

  // Regresión: DHTMLX llama `calculateEndDate` internamente con la Date que le pasamos.
  // Si start_date llega como timestamp ISO (con T...), el viejo `split('-')` producía NaN
  // y DHTMLX explotaba con "Invalid start_date argument for calculateEndDate method".
  it('parses ISO timestamp start_date as a valid local Date', () => {
    const node = makeNode({ id: 'iso-1', start_date: '2026-05-26T00:00:00.000Z', end_date: '2026-05-28T00:00:00.000Z' });
    const result = toGanttData([node], []);
    const start = result.data[0]?.start_date as Date;
    expect(start).toBeInstanceOf(Date);
    expect(Number.isNaN(start.getTime())).toBe(false);
    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(4);
    expect(start.getDate()).toBe(26);
  });

  it('never emits Invalid Date for malformed start_date', () => {
    const node = makeNode({ id: 'bad-1', start_date: 'not-a-date' as unknown as string });
    const result = toGanttData([node], []);
    const start = result.data[0]?.start_date as Date;
    expect(start).toBeInstanceOf(Date);
    expect(Number.isNaN(start.getTime())).toBe(false);
  });

  // Regresión: la DB genera duration_days = (end - start) (exclusivo, valor 4 para 10..14),
  // pero DHTMLX espera duration = nº de días que cubre la barra (inclusivo, valor 5).
  // Si usábamos `duration_days` como atajo, la barra terminaba un día antes y al resize
  // por la izquierda el extremo derecho retrocedía un día.
  it('computes inclusive duration from start/end ignoring stale duration_days from DB', () => {
    const node = makeNode({ id: 'span-1', start_date: '2026-01-10', end_date: '2026-01-14', duration_days: 4 });
    const result = toGanttData([node], []);
    expect(result.data[0]?.duration).toBe(5);
  });

  it('single-day task has duration 1', () => {
    const node = makeNode({ id: 'one-day', start_date: '2026-01-10', end_date: '2026-01-10', duration_days: 0 });
    const result = toGanttData([node], []);
    expect(result.data[0]?.duration).toBe(1);
  });
});
