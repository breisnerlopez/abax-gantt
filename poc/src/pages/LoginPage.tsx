import { useState } from 'react';
import { Navigate } from 'react-router';
import { storeToken } from '../lib/api';
import { isOidcConfigured, loginWithAuthentik } from '../lib/auth';
import type { AuthSession } from '../lib/types';

interface LoginPageProps {
  session: AuthSession | null;
  onDevToken: () => Promise<void> | void;
}

export function LoginPage({ session, onDevToken }: LoginPageProps) {
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (session?.accessToken) return <Navigate to="/gantt" replace />;

  const handleOidc = async () => {
    setError(null);
    try {
      await loginWithAuthentik();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión');
    }
  };

  const handleDevToken = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextToken = token.trim();
    if (!nextToken) return;
    storeToken(nextToken);
    await onDevToken();
  };

  return (
    <main className="auth-screen">
      <section className="login-layout">
        <div className="login-hero">
          <div className="brand-badge">A</div>
          <p className="eyebrow">ABAX Gantt</p>
          <h1>Una vista consolidada para gestionar WBS, tiempos y dependencias.</h1>
          <p>Authentik centraliza identidad, MFA y grupos OIDC. ABAX solo consume el access token contra Edge Functions.</p>
        </div>
        <div className="auth-card">
          <p className="eyebrow">Ingreso seguro</p>
          <h2>Continuar al Gantt</h2>
          <button className="authentik-button" onClick={handleOidc} disabled={!isOidcConfigured}>
            Continuar con Authentik
          </button>
          {!isOidcConfigured && <p className="form-hint">Configura `PUBLIC_AUTHENTIK_AUTHORITY` y `PUBLIC_AUTHENTIK_CLIENT_ID` para activar OIDC.</p>}
          {error && <p className="form-error">{error}</p>}
          <form onSubmit={handleDevToken} className="token-form">
            <label htmlFor="token">Fallback desarrollo</label>
            <textarea id="token" value={token} onChange={(event) => setToken(event.target.value)} placeholder="Access token Authentik" />
            <button type="submit">Usar token manual</button>
          </form>
        </div>
      </section>
    </main>
  );
}
