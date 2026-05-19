import type { Dependency, PortfolioData, WbsNode } from './types';

export function updateNodeInPortfolio(data: PortfolioData, node: WbsNode): PortfolioData {
  const update = (items: WbsNode[]) => items.map((item) => (item.id === node.id ? { ...item, ...node } : item));
  return { ...data, nodes: update(data.nodes), backlog: update(data.backlog) };
}

export function addDependencyToPortfolio(data: PortfolioData, dependency: Dependency): PortfolioData {
  return { ...data, dependencies: [...data.dependencies.filter((item) => item.id !== dependency.id), dependency] };
}

export function removeDependencyFromPortfolio(data: PortfolioData, dependencyId: string): PortfolioData {
  return { ...data, dependencies: data.dependencies.filter((item) => item.id !== dependencyId) };
}
