import { describe, expect, it } from 'vitest';
import { addDependencyToPortfolio, removeDependencyFromPortfolio, updateNodeInPortfolio } from './portfolio-state';
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
});
