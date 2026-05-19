import { createContext, useContext } from 'react';

export type ToastTone = 'success' | 'error' | 'info';

export interface ToastMessage {
  tone: ToastTone;
  title: string;
  detail?: string;
}

export interface ToastContextValue {
  notify: (toast: ToastMessage) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast debe usarse dentro de ToastProvider');
  return context;
}

export function errorMessage(error: unknown) {
  if (error instanceof Error) return cleanApiError(error.message);
  return 'Ocurrió un error inesperado';
}

function cleanApiError(message: string) {
  try {
    const parsed = JSON.parse(message) as { error?: string };
    return parsed.error ?? message;
  } catch {
    return message;
  }
}
