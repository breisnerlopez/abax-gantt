import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { ToastContext, type ToastMessage, type ToastTone } from '../lib/toast';

interface Toast {
  id: number;
  tone: ToastTone;
  title: string;
  detail?: string;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notify = useCallback((toast: ToastMessage) => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { ...toast, id }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, toast.tone === 'error' ? 5200 : 3200);
  }, []);

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast--${toast.tone}`}>
            <strong>{toast.title}</strong>
            {toast.detail && <span>{toast.detail}</span>}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
