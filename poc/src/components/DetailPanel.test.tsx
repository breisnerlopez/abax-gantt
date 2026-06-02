import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { deleteAttachment, getBudgetReport, listAttachments, uploadAttachment } from '../lib/api';
import { makeNode } from '../lib/test-fixtures';
import type { Profile, TaskAssignee } from '../lib/types';
import { DetailPanel } from './DetailPanel';

vi.mock('../lib/api', () => ({
  deleteAttachment: vi.fn(),
  getBudgetReport: vi.fn(),
  listAttachments: vi.fn(),
  uploadAttachment: vi.fn(),
}));

const users: Profile[] = [
  { id: 'user-1', email: 'ana@example.com', full_name: 'Ana Responsable', avatar_url: null, status: 'active' },
  { id: 'user-2', email: 'eva@example.com', full_name: 'Eva Ejecutora', avatar_url: null, status: 'active' },
];

const assignees: TaskAssignee[] = [
  { id: 'assignment-1', user_id: 'user-2', profiles: users[1] },
];

describe('DetailPanel permissions and progress', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('keeps structural fields read-only for executor users', async () => {
    const user = userEvent.setup();

    renderDetail({ canEditStructure: false, canReportProgress: true });

    expect(screen.getByText('Modo lectura. Como ejecutor solo puedes reportar avance y horas.')).toBeTruthy();
    expect(screen.getByLabelText('Nombre')).toHaveProperty('disabled', true);
    expect(screen.getByLabelText('Descripción')).toHaveProperty('disabled', true);
    expect(screen.getByLabelText('Inicio')).toHaveProperty('disabled', true);
    expect(screen.getByLabelText('Fin')).toHaveProperty('disabled', true);
    expect(screen.getByLabelText('Horas estimadas')).toHaveProperty('disabled', true);

    await user.click(screen.getByRole('tab', { name: 'Responsables' }));
    expect(screen.getByLabelText('Designar responsable')).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Guardar responsable' })).toHaveProperty('disabled', true);

    await user.click(screen.getByRole('tab', { name: 'Ejecutores' }));
    expect(screen.getByLabelText('Asignar ejecutor')).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Asignar' })).toHaveProperty('disabled', true);
    expect(screen.queryByRole('button', { name: 'Quitar' })).toBeNull();
  });

  it('allows executor users to report progress and actual hours', async () => {
    const user = userEvent.setup();
    const onReportProgress = vi.fn().mockResolvedValue(undefined);

    renderDetail({ canEditStructure: false, canReportProgress: true, onReportProgress });

    await user.click(screen.getByRole('tab', { name: 'Avance' }));

    // Slider hace autosave on mouseup
    const progress = screen.getByRole('slider');
    fireEvent.change(progress, { target: { value: '65' } });
    fireEvent.mouseUp(progress, { target: { value: '65' } });
    await waitFor(() => expect(onReportProgress).toHaveBeenCalledWith(0.65, null));

    onReportProgress.mockClear();
    await user.type(screen.getByLabelText('Registrar horas reales'), '3.5');
    await user.click(screen.getByRole('button', { name: /Registrar/i }));
    await waitFor(() => expect(onReportProgress).toHaveBeenCalledWith(0.65, 3.5));
  });

  it('allows responsible users to set the responsible user', async () => {
    const user = userEvent.setup();
    const onSetResponsible = vi.fn().mockResolvedValue(undefined);

    renderDetail({ onSetResponsible });

    await user.click(screen.getByRole('tab', { name: 'Responsables' }));
    await user.selectOptions(screen.getByLabelText('Designar responsable'), 'user-2');
    await user.click(screen.getByRole('button', { name: 'Guardar responsable' }));

    expect(onSetResponsible).toHaveBeenCalledWith('user-2');
  });

  it('allows responsible users to assign and remove executors', async () => {
    const user = userEvent.setup();
    const onAddAssignee = vi.fn().mockResolvedValue(undefined);
    const onRemoveAssignee = vi.fn().mockResolvedValue(undefined);

    renderDetail({ assignees: [], onAddAssignee, onRemoveAssignee });

    await user.click(screen.getByRole('tab', { name: 'Ejecutores' }));
    await user.selectOptions(screen.getByLabelText('Asignar ejecutor'), 'user-2');
    await user.click(screen.getByRole('button', { name: 'Asignar' }));

    expect(onAddAssignee).toHaveBeenCalledWith('user-2');

    cleanup();
    renderDetail({ onAddAssignee, onRemoveAssignee });

    await user.click(screen.getByRole('tab', { name: 'Ejecutores' }));
    await user.click(screen.getByRole('button', { name: 'Quitar' }));

    expect(onRemoveAssignee).toHaveBeenCalledWith('assignment-1');
  });

  it('renders budget metrics and API errors', async () => {
    const user = userEvent.setup();
    vi.mocked(getBudgetReport).mockResolvedValueOnce({
      project: { id: '11111111-1111-4111-9111-111111111111', name: 'Proyecto Alfa', status: 'active' },
      budget: { total: 100000, estimated_cost: 25000, consumed_pct: 25 },
      hours: { estimated: 80, actual: 32, variance_pct: -60 },
      progress: 40,
      task_count: 5,
      task_breakdown: [],
      hours_by_person: [],
    });

    renderDetail();

    // Presupuesto vive ahora dentro del dropdown "Más ▾" (rediseño Fase 8).
    await user.click(screen.getByRole('tab', { name: /Más/ }));
    await user.click(screen.getByRole('menuitemradio', { name: 'Presupuesto' }));

    expect(await screen.findByText('$100,000')).toBeTruthy();
    expect(screen.getByText('$25,000')).toBeTruthy();
    expect(screen.getByText('80 h')).toBeTruthy();
    expect(screen.getByText('32 h')).toBeTruthy();
    expect(screen.getByText('40%')).toBeTruthy();
    expect(screen.getByText('5')).toBeTruthy();

    cleanup();
    vi.mocked(getBudgetReport).mockRejectedValueOnce(new Error('Presupuesto no disponible'));
    renderDetail();

    // Presupuesto vive ahora dentro del dropdown "Más ▾" (rediseño Fase 8).
    await user.click(screen.getByRole('tab', { name: /Más/ }));
    await user.click(screen.getByRole('menuitemradio', { name: 'Presupuesto' }));

    expect(await screen.findByText('Presupuesto no disponible')).toBeTruthy();
  });

  it('lists, uploads, validates, and deletes attachments', async () => {
    const user = userEvent.setup();
    const attachment = { id: '77777777-7777-4777-9777-777777777777', project_id: '11111111-1111-4111-9111-111111111111', file_name: 'plan.pdf', file_path: 'plan.pdf', file_size: 2048, mime_type: 'application/pdf', download_url: 'https://example.com/plan.pdf' };
    vi.mocked(listAttachments)
      .mockResolvedValueOnce([attachment])
      .mockResolvedValueOnce([attachment])
      .mockResolvedValueOnce([]);
    vi.mocked(uploadAttachment).mockResolvedValueOnce({ id: '88888888-8888-4888-9888-888888888888', project_id: '11111111-1111-4111-9111-111111111111', file_name: 'evidencia.pdf', file_path: 'evidencia.pdf', file_size: 3, mime_type: 'application/pdf', download_url: null });
    vi.mocked(deleteAttachment).mockResolvedValueOnce(undefined);

    renderDetail();

    // Adjuntos vive ahora dentro del dropdown "Más ▾" (rediseño Fase 8).
    await user.click(screen.getByRole('tab', { name: /Más/ }));
    await user.click(screen.getByRole('menuitemradio', { name: 'Adjuntos' }));
    expect(await screen.findByText('plan.pdf')).toBeTruthy();
    expect(screen.getByText('2 KB')).toBeTruthy();

    const input = screen.getByLabelText('Subir adjunto');
    await user.upload(input, new File(['pdf'], 'evidencia.pdf', { type: 'application/pdf' }));

    await waitFor(() => {
      expect(uploadAttachment).toHaveBeenCalledWith('token', '11111111-1111-4111-9111-111111111111', expect.objectContaining({ name: 'evidencia.pdf' }));
    });

    await user.upload(input, new File(['bad'], 'malware.exe', { type: 'application/x-msdownload' }));
    expect(await screen.findByText('Tipo de archivo no permitido.')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Eliminar' }));
    expect(screen.getByRole('alertdialog', { name: 'Eliminar adjunto' })).toBeTruthy();
    expect(screen.getByText('Se eliminara plan.pdf. Esta accion no se puede deshacer.')).toBeTruthy();
    await user.click(within(screen.getByRole('alertdialog', { name: 'Eliminar adjunto' })).getByRole('button', { name: 'Eliminar' }));
    expect(deleteAttachment).toHaveBeenCalledWith('token', '77777777-7777-4777-9777-777777777777');
  });
});

function renderDetail(overrides: Partial<ComponentProps<typeof DetailPanel>> = {}) {
  const defaults: ComponentProps<typeof DetailPanel> = {
    node: makeNode({ name: 'Tarea crítica', responsible_id: 'user-1', progress: 0.2, estimated_hours: 12 }),
    token: 'token',
    users,
    assignees,
    onSave: vi.fn().mockResolvedValue(undefined),
    onUnschedule: vi.fn().mockResolvedValue(undefined),
    onAddAssignee: vi.fn().mockResolvedValue(undefined),
    onRemoveAssignee: vi.fn().mockResolvedValue(undefined),
    onReportProgress: vi.fn().mockResolvedValue(undefined),
    onSetResponsible: vi.fn().mockResolvedValue(undefined),
    canEditStructure: true,
    canReportProgress: true,
  };

  return render(<DetailPanel {...defaults} {...overrides} />);
}
