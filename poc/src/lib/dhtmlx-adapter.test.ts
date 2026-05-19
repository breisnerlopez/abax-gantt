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
});
