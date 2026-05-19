import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LoginPage } from './LoginPage';

describe('LoginPage', () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it('stores dev token and calls session refresh', async () => {
    const user = userEvent.setup();
    const onDevToken = vi.fn();

    render(
      <MemoryRouter>
        <LoginPage session={null} onDevToken={onDevToken} />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText('Fallback desarrollo'), ' dev-token ');
    await user.click(screen.getByRole('button', { name: 'Usar token manual' }));

    expect(window.localStorage.getItem('abax.auth.token')).toBe('dev-token');
    expect(onDevToken).toHaveBeenCalledTimes(1);
  });

  it('does not submit empty dev token', async () => {
    const user = userEvent.setup();
    const onDevToken = vi.fn();

    render(
      <MemoryRouter>
        <LoginPage session={null} onDevToken={onDevToken} />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Usar token manual' }));

    expect(window.localStorage.getItem('abax.auth.token')).toBeNull();
    expect(onDevToken).not.toHaveBeenCalled();
  });
});
