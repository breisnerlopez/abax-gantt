import { useCallback, useEffect, useState } from 'react';
import { clearToken, getStoredToken } from '../lib/api';
import { getDisplayName, getEmail, getOidcUser, getRole, logoutFromAuthentik } from '../lib/auth';
import type { AuthSession } from '../lib/types';

interface AuthState {
  status: 'loading' | 'authenticated' | 'anonymous';
  session: AuthSession | null;
}

export function useAuthSession() {
  const [state, setState] = useState<AuthState>({ status: 'loading', session: null });

  const refresh = useCallback(async () => {
    const user = await getOidcUser();
    if (user) {
      setState({
        status: 'authenticated',
        session: {
          accessToken: user.access_token,
          userName: getDisplayName(user),
          userEmail: getEmail(user),
          role: getRole(user),
        },
      });
      return;
    }

    const devToken = getStoredToken();
    if (devToken) {
      setState({ status: 'authenticated', session: { accessToken: devToken, userName: 'Dev User', userEmail: null, role: 'admin' } });
      return;
    }

    setState({ status: 'anonymous', session: null });
  }, []);

  useEffect(() => {
    let cancelled = false;

    getOidcUser().then((user) => {
      if (cancelled) return;
      if (user) {
        setState({
          status: 'authenticated',
          session: {
            accessToken: user.access_token,
            userName: getDisplayName(user),
            userEmail: getEmail(user),
            role: getRole(user),
          },
        });
        return;
      }

      const devToken = getStoredToken();
      if (devToken) {
        setState({ status: 'authenticated', session: { accessToken: devToken, userName: 'Dev User', userEmail: null, role: 'admin' } });
        return;
      }

      setState({ status: 'anonymous', session: null });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const logout = useCallback(async () => {
    clearToken();
    await logoutFromAuthentik();
    setState({ status: 'anonymous', session: null });
  }, []);

  // V-08 fix: cuando el cliente HTTP detecta un 401, vuelve la sesión a 'anonymous'.
  // Las rutas protegidas usan <Navigate /> al detectar !session, lo que redirige a /login.
  useEffect(() => {
    const handler = () => {
      clearToken();
      setState({ status: 'anonymous', session: null });
    };
    window.addEventListener('abax:unauthorized', handler);
    return () => window.removeEventListener('abax:unauthorized', handler);
  }, []);

  return { ...state, refresh, logout };
}
