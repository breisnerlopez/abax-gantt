import { describe, expect, it } from 'vitest';
import { addDependencyToPortfolio, removeDependencyFromPortfolio, updateNodeInPortfolio, updateNodeWithRollup } from './portfolio-state';
import { makeDependency, makeNode, makePortfolio } from './test-fixtures';

describe('portfolio-state', () => {
  it('updates matching nodes in scheduled and backlog lists', () => {
    const original = makeNode({ id: 'same', name: 'Original' });
    const data = makePortfolio({ nodes: [original], backlog: [original] });
    const result = updateNodeInPortfolio(data, makeNode({ id: 'same', name: 'Actualizado' }));

    expect(result.nodes[0]?.name).toBe('Actualizado');
    expect(result.backlog[0]?.name).toBe('Actualizado');
  });

  it('adds or replaces dependencies by id', () => {
    const data = makePortfolio({ dependencies: [makeDependency({ id: 'dep-1', type: 'FS' })] });
    const result = addDependencyToPortfolio(data, makeDependency({ id: 'dep-1', type: 'SS' }));

    expect(result.dependencies).toHaveLength(1);
    expect(result.dependencies[0]?.type).toBe('SS');
  });

  it('removes dependencies by id', () => {
    const data = makePortfolio({ dependencies: [makeDependency({ id: 'keep' }), makeDependency({ id: 'remove' })] });
    const result = removeDependencyFromPortfolio(data, 'remove');

    expect(result.dependencies.map((item) => item.id)).toEqual(['keep']);
  });

  describe('updateNodeWithRollup (mirror del trigger SQL en cliente)', () => {
    const project = makeNode({ id: 'p', type: 'project', parent_id: null, start_date: '2026-06-10', end_date: '2026-06-15' });
    const child = makeNode({ id: 'c', type: 'task', parent_id: 'p', start_date: '2026-06-10', end_date: '2026-06-15' });
    const base = makePortfolio({ nodes: [project, child] });

    it('reduce start de hija → padre amplía hacia atras', () => {
      const updatedChild = { ...child, start_date: '2026-05-01', end_date: '2026-06-15' };
      const result = updateNodeWithRollup(base, updatedChild);
      const newProject = result.nodes.find((n) => n.id === 'p');
      expect(newProject?.start_date).toBe('2026-05-01');
      expect(newProject?.end_date).toBe('2026-06-15');
    });

    it('extiende end de hija → padre amplía hacia adelante', () => {
      const updatedChild = { ...child, start_date: '2026-06-10', end_date: '2026-07-20' };
      const result = updateNodeWithRollup(base, updatedChild);
      const newProject = result.nodes.find((n) => n.id === 'p');
      expect(newProject?.start_date).toBe('2026-06-10');
      expect(newProject?.end_date).toBe('2026-07-20');
    });

    it('cambia ambos extremos a la vez', () => {
      const updatedChild = { ...child, start_date: '2026-04-01', end_date: '2026-08-30' };
      const result = updateNodeWithRollup(base, updatedChild);
      const newProject = result.nodes.find((n) => n.id === 'p');
      expect(newProject?.start_date).toBe('2026-04-01');
      expect(newProject?.end_date).toBe('2026-08-30');
    });
  });
});
