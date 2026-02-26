import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deleteAccount } from '../account';
import * as auth from '../../stores/auth';

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('deleteAccount', () => {
  it('returns { ok: true } on 204 and does not clear auth state', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 204,
        ok: true,
        text: () => Promise.resolve(''),
      })
    );
    const setSpy = vi.spyOn(auth, 'setCurrentUser').mockImplementation(() => {});

    const result = await deleteAccount();

    expect(result).toEqual({ ok: true });
    expect(setSpy).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledWith(
      '/api/account',
      expect.objectContaining({ method: 'DELETE', credentials: 'include' })
    );
  });

  it('returns { ok: false, status, error } on 404 with error body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 404,
        ok: false,
        statusText: 'Not Found',
        text: () => Promise.resolve(JSON.stringify({ error: 'User not found' })),
      })
    );

    const result = await deleteAccount();

    expect(result).toEqual({
      ok: false,
      status: 404,
      error: 'User not found',
    });
  });

  it('returns { ok: false } on 5xx and uses statusText when no error body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 500,
        ok: false,
        statusText: 'Internal Server Error',
        text: () => Promise.resolve(''),
      })
    );

    const result = await deleteAccount();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
      expect(result.error).toBe('Internal Server Error');
    }
  });

  it('on 401, apiFetch clears auth and deleteAccount returns { ok: false, status: 401 }', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 401,
        ok: false,
        statusText: 'Unauthorized',
        text: () => Promise.resolve(''),
      })
    );
    const setSpy = vi.spyOn(auth, 'setCurrentUser').mockImplementation(() => {});

    const result = await deleteAccount();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(401);
    }
    expect(setSpy).toHaveBeenCalledWith(null);
  });
});
