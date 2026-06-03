import type { Dependency, PortfolioData, WbsNode } from './types';

export function updateNodeInPortfolio(data: PortfolioData, node: WbsNode): PortfolioData {
  const update = (items: WbsNode[]) => items.map((item) => (item.id === node.id ? { ...item, ...node } : item));
  return { ...data, nodes: update(data.nodes), backlog: update(data.backlog) };
}

// Replica del trigger SQL `recalc_node_dates` en cliente. Se usa como optimistic
// update tras mover/reprogramar un hijo, para que el padre se vea ajustado SIN
// esperar al round-trip de un refetch.
//
// Reglas:
//   - Solo contenedores (project/stage/group) se recalculan; task y milestone
//     conservan sus fechas propias.
//   - Hijos con is_unscheduled=true o sin start_date se ignoran.
//   - end_date queda igualada a start_date si no hay end (constraint del schema).
//   - Si un contenedor se queda sin hijos schedulados, sus fechas vuelven a null
//     e is_unscheduled = true.
const CONTAINER_TYPES = new Set(['project', 'stage', 'group']);

function recalcContainer(nodes: WbsNode[], containerId: string): WbsNode | null {
  const idx = nodes.findIndex((n) => n.id === containerId);
  if (idx < 0) return null;
  const container = nodes[idx];
  if (!CONTAINER_TYPES.has(container.type)) return null;

  let minStart: string | null = null;
  let maxEnd: string | null = null;
  for (const child of nodes) {
    if (child.parent_id !== containerId) continue;
    if (child.is_unscheduled) continue;
    if (!child.start_date) continue;
    if (minStart === null || child.start_date < minStart) minStart = child.start_date;
    const childEnd = child.end_date ?? child.start_date;
    if (maxEnd === null || childEnd > maxEnd) maxEnd = childEnd;
  }

  const newStart = minStart;
  const newEnd = newStart !== null ? (maxEnd ?? newStart) : null;
  const newUnsched = newStart === null;

  if (
    container.start_date === newStart &&
    container.end_date === newEnd &&
    container.is_unscheduled === newUnsched
  ) {
    return null;
  }

  return { ...container, start_date: newStart, end_date: newEnd, is_unscheduled: newUnsched };
}

// Aplica un patch a un nodo y propaga el rollup a sus ancestros. `previousParentId`
// permite re-evaluar el padre VIEJO cuando el nodo cambia de parent.
export function updateNodeWithRollup(
  data: PortfolioData,
  node: WbsNode,
  previousParentId?: string | null,
): PortfolioData {
  let nodes = data.nodes.map((item) => (item.id === node.id ? { ...item, ...node } : item));
  if (!nodes.some((n) => n.id === node.id)) nodes = [...nodes, node];

  const visited = new Set<string>();
  const ascendAndRecalc = (startId: string | null | undefined) => {
    let current: string | null = startId ?? null;
    while (current && !visited.has(current)) {
      visited.add(current);
      const updated = recalcContainer(nodes, current);
      const next: string | null = (nodes.find((n) => n.id === current)?.parent_id) ?? null;
      if (updated) {
        nodes = nodes.map((n) => (n.id === updated.id ? updated : n));
      }
      current = next;
    }
  };

  if (previousParentId && previousParentId !== node.parent_id) {
    ascendAndRecalc(previousParentId);
  }
  ascendAndRecalc(node.parent_id);

  const backlog = data.backlog.map((item) => (item.id === node.id ? { ...item, ...node } : item));
  return { ...data, nodes, backlog };
}

export function addDependencyToPortfolio(data: PortfolioData, dependency: Dependency): PortfolioData {
  return { ...data, dependencies: [...data.dependencies.filter((item) => item.id !== dependency.id), dependency] };
}

export function removeDependencyFromPortfolio(data: PortfolioData, dependencyId: string): PortfolioData {
  return { ...data, dependencies: data.dependencies.filter((item) => item.id !== dependencyId) };
}

/**
 * Devuelve el set de ids del nodo y todos sus descendientes (BFS por parent_id).
 * Útil para contar antes de borrar y para limpiar el cache local sin
 * esperar al re-fetch.
 */
export function collectSubtreeIds(nodes: WbsNode[], rootId: string): Set<string> {
  const childMap = new Map<string, WbsNode[]>();
  nodes.forEach((n) => {
    if (!n.parent_id) return;
    const arr = childMap.get(n.parent_id);
    if (arr) arr.push(n); else childMap.set(n.parent_id, [n]);
  });
  const acc = new Set<string>();
  const stack: string[] = [rootId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (acc.has(id)) continue;
    acc.add(id);
    (childMap.get(id) ?? []).forEach((c) => stack.push(c.id));
  }
  return acc;
}

/**
 * Borra un nodo y toda su subtree del cache local. También limpia las
 * dependencias en las que cualquiera de los nodos borrados participe
 * (el backend ya las elimina vía ON DELETE CASCADE).
 */
export function removeNodeFromPortfolio(data: PortfolioData, nodeId: string): PortfolioData {
  const toRemove = collectSubtreeIds(data.nodes, nodeId);
  // El nodo también puede estar en backlog si era unscheduled.
  const backlogIds = new Set(data.backlog.map((n) => n.id));
  return {
    ...data,
    nodes: data.nodes.filter((n) => !toRemove.has(n.id)),
    backlog: data.backlog.filter((n) => !toRemove.has(n.id) && backlogIds.has(n.id)),
    dependencies: data.dependencies.filter(
      (d) => !toRemove.has(d.predecessor_id) && !toRemove.has(d.successor_id),
    ),
  };
}
