import { useCallback, useEffect, useRef, useState } from 'react';
import { loadPortfolio, type PortfolioFilters } from '../lib/api';
import { addDependencyToPortfolio, removeDependencyFromPortfolio, updateNodeInPortfolio } from '../lib/portfolio-state';
import type { Dependency, PortfolioData, WbsNode } from '../lib/types';

type PortfolioState =
  | { status: 'idle' | 'loading'; data: null; error: null }
  | { status: 'ready'; data: PortfolioData; error: null }
  | { status: 'error'; data: null; error: Error };

type PortfolioResult = PortfolioState & {
  refetch: () => Promise<PortfolioData | null>;
  updateNodeLocal: (node: WbsNode) => void;
  addDependencyLocal: (dependency: Dependency) => void;
  removeDependencyLocal: (dependencyId: string) => void;
};

const POLL_INTERVAL_MS = 30_000;
const POLL_MUTE_WINDOW_MS = 5_000;

export function usePortfolio(token: string | null, filters?: PortfolioFilters): PortfolioResult {
  const [state, setState] = useState<PortfolioState>({ status: 'idle', data: null, error: null });
  const pollRef = useRef<ReturnType<typeof setInterval>>(undefined);
  // Timestamp de la última mutación local. Si un response de polling llega
  // dentro de la ventana mute (5s), lo descartamos para que no sobrescriba
  // un cambio que el backend aún está procesando.
  const lastMutationRef = useRef<number>(0);

  const refetch = useCallback(async () => {
    if (!token) return null;
    setState((prev) => (prev.status === 'ready' ? prev : { status: 'loading', data: null, error: null }));
    try {
      const data = await loadPortfolio(token, filters);
      setState({ status: 'ready', data, error: null });
      return data;
    } catch (error) {
      setState({ status: 'error', data: null, error: error instanceof Error ? error : new Error('Error desconocido') });
      return null;
    }
  }, [token, filters]);

  const updateNodeLocal = useCallback((node: WbsNode) => {
    lastMutationRef.current = Date.now();
    setState((current) => {
      if (current.status !== 'ready') return current;
      return { ...current, data: updateNodeInPortfolio(current.data, node) };
    });
  }, []);

  const addDependencyLocal = useCallback((dependency: Dependency) => {
    lastMutationRef.current = Date.now();
    setState((current) => {
      if (current.status !== 'ready') return current;
      return { ...current, data: addDependencyToPortfolio(current.data, dependency) };
    });
  }, []);

  const removeDependencyLocal = useCallback((dependencyId: string) => {
    lastMutationRef.current = Date.now();
    setState((current) => {
      if (current.status !== 'ready') return current;
      return { ...current, data: removeDependencyFromPortfolio(current.data, dependencyId) };
    });
  }, []);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    loadPortfolio(token, filters)
      .then((data) => {
        if (!cancelled) setState({ status: 'ready', data, error: null });
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ status: 'error', data: null, error: error instanceof Error ? error : new Error('Error desconocido') });
      });

    pollRef.current = setInterval(() => {
      if (cancelled) return;
      const startedAt = Date.now();
      loadPortfolio(token, filters)
        .then((data) => {
          if (cancelled) return;
          // Si hubo una mutación local entre el inicio del fetch y ahora,
          // descartamos la respuesta para no pisar el cambio reciente.
          if (lastMutationRef.current >= startedAt - 250 || Date.now() - lastMutationRef.current < POLL_MUTE_WINDOW_MS) {
            return;
          }
          setState((prev) => {
            if (prev.status !== 'ready') return prev;
            return { status: 'ready', data, error: null };
          });
        })
        .catch(() => {});
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(pollRef.current);
    };
  }, [token, filters]);

  const actions = { refetch, updateNodeLocal, addDependencyLocal, removeDependencyLocal };
  if (token && state.status === 'idle') return { status: 'loading' as const, data: null, error: null, ...actions };
  if (!token && state.status !== 'idle') return { status: 'idle' as const, data: null, error: null, ...actions };
  return { ...state, ...actions };
}
