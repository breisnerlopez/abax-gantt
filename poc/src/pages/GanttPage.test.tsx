import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../components/ToastProvider';
import { GanttPage } from './GanttPage';
import { makeNode, makePortfolio } from '../lib/test-fixtures';
import type { AuthSession, Dependency, DependencyType, PortfolioData, Profile, WbsNode } from '../lib/types';

const mocks = vi.hoisted(() => ({
  loadPortfolio: vi.fn(),
  createWbsNode: vi.fn(),
  createProject: vi.fn(),
  scheduleWbsNode: vi.fn(),
  updateWbsNode: vi.fn(),
  listAssignees: vi.fn(),
  addAssignee: vi.fn(),
  removeAssignee: vi.fn(),
  reportProgress: vi.fn(),
  unscheduleWbsNode: vi.fn(),
  createDependency: vi.fn(),
  deleteDependency: vi.fn(),
  moveWbsNode: vi.fn(),
}));

vi.mock('../lib/api', () => mocks);

vi.mock('../components/GanttCanvas', () => ({
  GanttCanvas: ({ nodes, dependencies, onCreateDependency, onDeleteDependency, onMoveNode }: MockGanttCanvasProps) => (
    <div data-testid="gantt-canvas">
      <span>Gantt mock</span>
      <button onClick={() => void onCreateDependency({ predecessor_id: nodes[0]?.id ?? 'node-1', successor_id: nodes[1]?.id ?? 'node-2', type: 'FS' })}>Mock crear dependencia</button>
      <button onClick={() => void onDeleteDependency(dependencies[0]?.id ?? '55555555-5555-4555-9555-555555555555')}>Mock eliminar dependencia</button>
      <button onClick={() => void onMoveNode(nodes[1]?.id ?? 'node-2', { parent_id: nodes[0]?.id ?? null, sort_order: 2 })}>Mock mover nodo</button>
    </div>
  ),
}));

interface MockGanttCanvasProps {
  nodes: WbsNode[];
  dependencies: Dependency[];
  users: Profile[];
  onSelectNode: (node: WbsNode | null) => void;
  onCreateDependency: (input: { predecessor_id: string; successor_id: string; type: DependencyType }) => Promise<Dependency | null>;
  onDeleteDependency: (dependencyId: string) => Promise<boolean>;
  onMoveNode: (nodeId: string, input: { parent_id?: string | null; sort_order?: number }) => Promise<boolean>;
  canEditStructure: boolean;
  onValidationError: (message: string) => void;
}

const projectNode = makeNode({ id: '11111111-1111-4111-9111-111111111111', type: 'project', name: 'Proyecto Alfa', parent_id: null });
const taskNode = makeNode({ id: '22222222-2222-4222-9222-222222222222', type: 'task', name: 'Tarea Alfa', parent_id: '11111111-1111-4111-9111-111111111111' });
const backlogNode = makeNode({ id: '33333333-3333-4333-9333-333333333333', name: 'Tarea backlog', is_unscheduled: true, start_date: null, end_date: null, parent_id: '11111111-1111-4111-9111-111111111111' });
const dependency = { id: '55555555-5555-4555-9555-555555555555', predecessor_id: '11111111-1111-4111-9111-111111111111', successor_id: '22222222-2222-4222-9222-222222222222', type: 'FS' as const };

const basePortfolio: PortfolioData = makePortfolio({
  projects: [{ id: '11111111-1111-4111-9111-111111111111', name: 'Proyecto Alfa', description: null, status: 'active', budget_total: null }],
  nodes: [projectNode, taskNode],
  backlog: [backlogNode],
  dependencies: [dependency],
});

const responsableSession: AuthSession = { accessToken: 'token', userName: 'Responsable', userEmail: null, role: 'responsable' };
const ejecutorSession: AuthSession = { accessToken: 'token', userName: 'Ejecutor', userEmail: null, role: 'ejecutor' };

describe('GanttPage mocked flows', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('blocks structural actions for executor role', async () => {
    mockDefaults();
    mocks.loadPortfolio.mockResolvedValue(basePortfolio);

    renderPage(ejecutorSession, projectNode);

    expect(await screen.findByTestId('gantt-canvas')).toBeTruthy();
    expect(screen.getByRole('button', { name: /\+ Proyecto/ })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: /\+ Nodo hijo/ })).toHaveProperty('disabled', true);
  });

  it('allows responsable to create unscheduled child node', async () => {
    mockDefaults();
    const user = userEvent.setup();
    const createdNode = makeNode({ id: '44444444-4444-4444-9444-444444444444', name: 'Nueva tarea', parent_id: '11111111-1111-4111-9111-111111111111', is_unscheduled: true, start_date: null, end_date: null });
    mocks.loadPortfolio.mockResolvedValue(basePortfolio);
    mocks.createWbsNode.mockResolvedValue(createdNode);

    renderPage(responsableSession, projectNode);

    await screen.findByTestId('gantt-canvas');
    await user.click(screen.getByRole('button', { name: /\+ Nodo hijo/ }));
    await user.type(screen.getByPlaceholderText('Ej. Diseño estructural'), 'Nueva tarea');
    await user.click(screen.getByRole('button', { name: 'Crear' }));

    await waitFor(() => {
      expect(mocks.createWbsNode).toHaveBeenCalledWith('token', expect.objectContaining({
        parent_id: '11111111-1111-4111-9111-111111111111',
        name: 'Nueva tarea',
        start_date: null,
        end_date: null,
      }));
    });
  });

  it('schedules a backlog item from backlog panel', async () => {
    mockDefaults();
    const user = userEvent.setup();
    const scheduled = { ...backlogNode, is_unscheduled: false, start_date: '2026-05-20', end_date: '2026-05-22' };
    mocks.loadPortfolio.mockResolvedValue(basePortfolio);
    mocks.scheduleWbsNode.mockResolvedValue(scheduled);

    renderPage(responsableSession, projectNode);

    await screen.findByTestId('gantt-canvas');
    await user.click(screen.getByLabelText(/Abrir backlog/i));
    await user.click(screen.getByRole('button', { name: 'Programar' }));

    const form = screen.getByRole('button', { name: 'Programar' }).closest('form');
    expect(form).not.toBeNull();
    const inputs = within(form as HTMLElement).getAllByDisplayValue('') as HTMLInputElement[];
    await user.type(inputs[0]!, '2026-05-20');
    await user.type(inputs[1]!, '2026-05-22');
    await user.click(within(form as HTMLElement).getByRole('button', { name: 'Programar' }));

    await waitFor(() => {
      expect(mocks.scheduleWbsNode).toHaveBeenCalledWith('token', '33333333-3333-4333-9333-333333333333', { start_date: '2026-05-20', end_date: '2026-05-22' });
    });
  });

  it('creates and deletes dependencies from gantt callbacks', async () => {
    mockDefaults();
    const user = userEvent.setup();
    const createdDependency = { id: '66666666-6666-4666-9666-666666666666', predecessor_id: '11111111-1111-4111-9111-111111111111', successor_id: '22222222-2222-4222-9222-222222222222', type: 'FS' as const };
    mocks.loadPortfolio.mockResolvedValue(basePortfolio);
    mocks.createDependency.mockResolvedValue(createdDependency);
    mocks.deleteDependency.mockResolvedValue(undefined);

    renderPage(responsableSession, taskNode);

    await screen.findByTestId('gantt-canvas');
    await user.click(screen.getByRole('button', { name: 'Mock crear dependencia' }));
    await user.click(screen.getByRole('button', { name: 'Mock eliminar dependencia' }));

    expect(mocks.createDependency).toHaveBeenCalledWith('token', { predecessor_id: '11111111-1111-4111-9111-111111111111', successor_id: '22222222-2222-4222-9222-222222222222', type: 'FS' });
    expect(mocks.deleteDependency).toHaveBeenCalledWith('token', '55555555-5555-4555-9555-555555555555');
  });

  it('moves nodes from gantt callbacks', async () => {
    mockDefaults();
    const user = userEvent.setup();
    const movedNode = { ...taskNode, sort_order: 2 };
    mocks.loadPortfolio.mockResolvedValue(basePortfolio);
    mocks.moveWbsNode.mockResolvedValue(movedNode);

    renderPage(responsableSession, taskNode);

    await screen.findByTestId('gantt-canvas');
    await user.click(screen.getByRole('button', { name: 'Mock mover nodo' }));

    expect(mocks.moveWbsNode).toHaveBeenCalledWith('token', '22222222-2222-4222-9222-222222222222', { parent_id: '11111111-1111-4111-9111-111111111111', sort_order: 2 });
  });

  it('sends a scheduled task to backlog from the detail panel', async () => {
    mockDefaults();
    // Panel oculto por default → activar antes de renderizar
    window.localStorage.setItem('abax.detail.visible', '1');
    const user = userEvent.setup();
    const unscheduled = { ...taskNode, is_unscheduled: true, start_date: null, end_date: null };
    mocks.loadPortfolio.mockResolvedValue(basePortfolio);
    mocks.unscheduleWbsNode.mockResolvedValue(unscheduled);

    renderPage(responsableSession, taskNode);

    await screen.findByTestId('gantt-canvas');
    await user.click(screen.getByRole('button', { name: 'Enviar al backlog' }));

    await waitFor(() => {
      expect(mocks.unscheduleWbsNode).toHaveBeenCalledWith('token', '22222222-2222-4222-9222-222222222222');
    });
    window.localStorage.removeItem('abax.detail.visible');
  });
});

function renderPage(session: AuthSession, selectedNode = projectNode) {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <GanttPage session={session} selectedNode={selectedNode} onSelectNode={vi.fn()} onLogout={vi.fn()} />
      </ToastProvider>
    </MemoryRouter>,
  );
}

function mockDefaults() {
  mocks.listAssignees.mockResolvedValue([]);
  mocks.loadPortfolio.mockResolvedValue(basePortfolio);
}
