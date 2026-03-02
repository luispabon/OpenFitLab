import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkAuth, logout, state, setCurrentUser } from '../../stores/auth.svelte';

describe('auth store', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    state.user = null;
    state.authChecked = false;
    state.authLoading = true;
  });

  it('sets current user on successful /api/auth/me', async () => {
    vi.spyOn(globalThis as unknown as { fetch: typeof fetch }, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'u1', displayName: 'Alice', avatarUrl: null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }) as unknown as Response
    );

    await checkAuth();

    expect(state.user).toEqual({ id: 'u1', displayName: 'Alice', avatarUrl: null });
    expect((globalThis as unknown as { fetch: typeof fetch }).fetch).toHaveBeenCalledWith(
      '/api/auth/me',
      {
        credentials: 'include',
      }
    );
  });

  it('sets user to null when /api/auth/me returns non-ok', async () => {
    setCurrentUser({ id: 'u1', displayName: 'Alice', avatarUrl: null });
    vi.spyOn(globalThis as unknown as { fetch: typeof fetch }, 'fetch').mockResolvedValueOnce(
      new Response(null, { status: 401 }) as unknown as Response
    );

    await checkAuth();

    expect(state.user).toBeNull();
  });

  it('clears session on logout', async () => {
    vi.spyOn(globalThis as unknown as { fetch: typeof fetch }, 'fetch').mockResolvedValueOnce(
      new Response(null, { status: 200 }) as unknown as Response
    );
    await logout();
    expect((globalThis as unknown as { fetch: typeof fetch }).fetch).toHaveBeenCalledWith(
      '/api/auth/logout',
      {
        method: 'POST',
        credentials: 'include',
      }
    );
  });
});
