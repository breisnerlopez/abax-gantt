import { lazy, Suspense, useCallback, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { useAuthSession } from './hooks/useAuthSession';
import { AuthCallbackPage } from './pages/AuthCallbackPage';
import { LoginPage } from './pages/LoginPage';
import { ToastProvider } from './components/ToastProvider';
import { config } from './lib/runtimeConfig';
import { ThemeProvider } from './lib/theme';
import type { WbsNode } from './lib/types';

const GanttPage = lazy(() => import('./pages/GanttPage').then((module) => ({ default: module.GanttPage })));
const AdminPage = lazy(() => import('./pages/AdminPage').then((module) => ({ default: module.AdminPage })));

export default function App() {
  const auth = useAuthSession();
  const [selectedNode, setSelectedNode] = useState<WbsNode | null>(null);

  const handleLogout = useCallback(async () => {
    setSelectedNode(null);
    await auth.logout();
  }, [auth]);

  if (auth.status === 'loading') {
    return (
      <main className="auth-screen">
        <section className="callback-card">
          <div className="spinner" />
          <h1>Cargando sesión</h1>
          <p>Validando token local y sesión OIDC.</p>
        </section>
      </main>
    );
  }

  return (
    <ThemeProvider>
      <ToastProvider>
        <BrowserRouter basename={config.publicBasePath === '/' ? undefined : config.publicBasePath.replace(/\/$/, '')}>
          <Routes>
            <Route path="/login" element={<LoginPage session={auth.session} onDevToken={auth.refresh} />} />
            <Route path="/auth/callback" element={<AuthCallbackPage onComplete={auth.refresh} />} />
            <Route
              path="/gantt"
              element={(
                <Suspense fallback={<RouteLoading />}>
                  <GanttPage session={auth.session} selectedNode={selectedNode} onSelectNode={setSelectedNode} onLogout={handleLogout} />
                </Suspense>
              )}
            />
            <Route
              path="/admin"
              element={(
                <Suspense fallback={<RouteLoading />}>
                  <AdminPage session={auth.session} onLogout={handleLogout} />
                </Suspense>
              )}
            />
            <Route path="*" element={<Navigate to={auth.session ? '/gantt' : '/login'} replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </ThemeProvider>
  );
}

function RouteLoading() {
  return (
    <main className="auth-screen">
      <section className="callback-card">
        <div className="spinner" />
        <h1>Cargando Gantt</h1>
        <p>Preparando módulos de planificación.</p>
      </section>
    </main>
  );
}
