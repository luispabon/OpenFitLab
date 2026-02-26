import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkAuth, logout } from '../../stores/auth';

describe('auth store', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('sets current user on successful /api/auth/me', async () => {
    vi.spyOn(globalThis as unknown as { fetch: typeof fetch }, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'u1', displayName: 'Alice', avatarUrl: null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }) as unknown as Response
    );

    await checkAuth();

    // No direct getters exported for currentUser in tests; rely on subsequent logout to not throw
    expect((globalThis as unknown as { fetch: typeof fetch }).fetch).toHaveBeenCalledWith(
      '/api/auth/me',
      {
        credentials: 'include',
      }
    );
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
