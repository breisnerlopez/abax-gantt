import type { Dependency, PortfolioData, WbsNode } from './types';

export function makeNode(overrides: Partial<WbsNode> = {}): WbsNode {
  return {
    id: 'aaaaaaaa-1111-4111-9111-aaaaaaaaaaaa',
    project_id: '11111111-1111-4111-9111-111111111111',
    parent_id: null,
    name: 'Nodo 1',
    type: 'task',
    description: null,
    start_date: '2026-05-01',
    end_date: '2026-05-03',
    duration_days: null,
    progress: 0.2,
    estimated_hours: null,
    estimated_cost: null,
    color: null,
    sort_order: 0,
    responsible_id: null,
    is_unscheduled: false,
    path: 'n_aaaaaaaa_1111_4111_9111_aaaaaaaaaaaa',
    task_assignees: [],
    ...overrides,
  };
}

export function makeDependency(overrides: Partial<Dependency> = {}): Dependency {
  return { id: '55555555-5555-4555-9555-555555555555', predecessor_id: 'aaaaaaaa-1111-4111-9111-aaaaaaaaaaaa', successor_id: 'bbbbbbbb-2222-4222-9222-bbbbbbbbbbbb', type: 'FS', ...overrides };
}

export function makePortfolio(overrides: Partial<PortfolioData> = {}): PortfolioData {
  return {
    projects: [],
    users: [],
    nodes: [],
    backlog: [],
    dependencies: [],
    summary: null,
    ...overrides,
  };
}
