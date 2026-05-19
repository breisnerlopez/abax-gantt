import { describe, expect, it } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useAuthSession } from '../hooks/useAuthSession';

describe('useAuthSession', () => {
  it('inicia loading', () => { const { result } = renderHook(() => useAuthSession()); expect(result.current.status).toBe('loading'); });
  it('pasa a anonymous sin token', async () => { localStorage.clear(); const { result } = renderHook(() => useAuthSession()); await waitFor(() => expect(result.current.status).toBe('anonymous')); });
  it('usa dev token', async () => { localStorage.setItem('abax.auth.token', 'dev'); const { result } = renderHook(() => useAuthSession()); await waitFor(() => expect(result.current.status).toBe('authenticated')); expect(result.current.session?.accessToken).toBe('dev'); localStorage.removeItem('abax.auth.token'); });
  it('logout limpia token', async () => { localStorage.setItem('abax.auth.token', 't'); const { result } = renderHook(() => useAuthSession()); await waitFor(() => expect(result.current.status).toBe('authenticated')); await act(async () => { await result.current.logout(); }); expect(result.current.status).toBe('anonymous'); expect(localStorage.getItem('abax.auth.token')).toBeNull(); });
});
