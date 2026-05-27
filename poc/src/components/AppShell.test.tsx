import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AppShell } from '../components/AppShell';
import { ThemeProvider } from '../lib/theme';
import type { Summary } from '../lib/types';

const mockSummary: Summary = { active_projects: 3, total_projects: 5, global_progress: 45, upcoming_milestones_count: 7, total_budget: 1500000, total_estimated_cost: 600000, budget_consumed_pct: 40, total_tasks: 12, unscheduled_tasks: 4 };

function renderShell(summary?: Summary | null) { return render(<ThemeProvider><AppShell summary={summary ?? mockSummary} userName="Admin Test" onLogout={() => {}}><div data-testid="child" /></AppShell></ThemeProvider>); }

describe('AppShell', () => {
  it('renderiza topbar con marca y userName', () => { renderShell(); expect(screen.getByText('ABAX Gantt')).toBeInTheDocument(); expect(screen.getByText('Admin Test')).toBeInTheDocument(); });
  it('renderiza 5 KPI widgets', () => { renderShell(); expect(screen.getByText('Proyectos activos')).toBeInTheDocument(); expect(screen.getByText('Avance global')).toBeInTheDocument(); expect(screen.getByText('Hitos próximos')).toBeInTheDocument(); expect(screen.getByText('Tareas sin fecha')).toBeInTheDocument(); expect(screen.getByText('Presupuesto')).toBeInTheDocument(); });
  it('maneja summary null', () => { renderShell(null); expect(screen.getByText('Proyectos activos')).toBeInTheDocument(); });
  it('renderiza children', () => { renderShell(); expect(screen.getByTestId('child')).toBeInTheDocument(); });
  it('llama onSearch al escribir (con debounce)', async () => {
    const fn = vi.fn();
    render(<ThemeProvider><AppShell summary={mockSummary} userName="T" onLogout={() => {}} onSearch={fn}><div /></AppShell></ThemeProvider>);
    fireEvent.change(screen.getByPlaceholderText(/Buscar tareas/i), { target: { value: 'q' } });
    // El input se actualiza al instante; onSearch llega tras el debounce (250 ms).
    await waitFor(() => expect(fn).toHaveBeenCalledWith('q'), { timeout: 1000 });
  });
  it('renderiza botones Admin y Salir', () => { renderShell(); expect(screen.getByText('Admin')).toBeInTheDocument(); expect(screen.getByText('Salir')).toBeInTheDocument(); });
  it('renderiza toggle de tema', () => { renderShell(); expect(screen.getByTitle(/Cambiar a tema/)).toBeInTheDocument(); });
  it('iniciales del usuario', () => { render(<ThemeProvider><AppShell summary={mockSummary} userName="Carlos Mendoza" onLogout={() => {}}><div /></AppShell></ThemeProvider>); expect(screen.getByText('CM')).toBeInTheDocument(); });
});
