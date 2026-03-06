import { describe, it, expect, vi, beforeEach } from 'vitest';
import { completeSignup, declineSignup } from '../auth';

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('completeSignup', () => {
  it('returns user and csrfToken on 201', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 201,
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'u1',
            displayName: 'Alice',
            avatarUrl: 'https://avatar',
            csrfToken: 'token-xyz',
          }),
      })
    );

    const result = await completeSignup();

    expect(result).toEqual({
      ok: true,
      user: { id: 'u1', displayName: 'Alice', avatarUrl: 'https://avatar' },
      csrfToken: 'token-xyz',
    });
    expect(fetch).toHaveBeenCalledWith(
      '/api/auth/complete-signup',
      expect.objectContaining({ method: 'POST', credentials: 'include' })
    );
  });

  it('returns { ok: false, status, error } on 400', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 400,
        ok: false,
        statusText: 'Bad Request',
        text: () => Promise.resolve(JSON.stringify({ error: 'No pending signup found.' })),
      })
    );

    const result = await completeSignup();

    expect(result).toEqual({
      ok: false,
      status: 400,
      error: 'No pending signup found.',
    });
  });
});

describe('declineSignup', () => {
  it('returns { ok: true } on 200', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        text: () => Promise.resolve(''),
      })
    );

    const result = await declineSignup();

    expect(result).toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledWith(
      '/api/auth/decline-signup',
      expect.objectContaining({ method: 'POST', credentials: 'include' })
    );
  });

  it('returns { ok: false, status, error } on 500', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 500,
        ok: false,
        statusText: 'Internal Server Error',
        text: () => Promise.resolve(''),
      })
    );

    const result = await declineSignup();

    expect(result).toEqual({
      ok: false,
      status: 500,
      error: 'Internal Server Error',
    });
  });
});
