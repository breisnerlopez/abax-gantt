import { useEffect, useState } from 'react';
import { Navigate } from 'react-router';
import { completeSignin } from '../lib/auth';

interface AuthCallbackPageProps {
  onComplete: () => Promise<void> | void;
}

export function AuthCallbackPage({ onComplete }: AuthCallbackPageProps) {
  const [status, setStatus] = useState<'loading' | 'done' | 'error'>('loading');
  const [message, setMessage] = useState('Intercambiando código por tokens...');

  useEffect(() => {
    let cancelled = false;

    completeSignin()
      .then(async () => {
        await onComplete();
        if (!cancelled) setStatus('done');
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : 'No se pudo completar el login');
          setStatus('error');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [onComplete]);

  if (status === 'done') return <Navigate to="/gantt" replace />;

  return (
    <main className="auth-screen">
      <section className="callback-card">
        <div className="spinner" />
        <h1>{status === 'error' ? 'No se pudo iniciar sesión' : 'Validando sesión'}</h1>
        <p>{message}</p>
        {status === 'error' && <a href="/gantt/login">Volver al login</a>}
      </section>
    </main>
  );
}
