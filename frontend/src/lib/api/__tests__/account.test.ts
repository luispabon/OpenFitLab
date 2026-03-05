import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  deleteAccount,
  exportUserData,
  getAnalyticsEnabled,
  setAnalyticsEnabled,
} from '../account';
import * as auth from '../../stores/auth.svelte';

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
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

  it('returns { ok: false, status, error } when response has non-JSON body (catch branch)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 500,
        ok: false,
        statusText: 'Internal Server Error',
        text: () => Promise.resolve('plain text error body'),
      })
    );

    const result = await deleteAccount();

    expect(result).toEqual({
      ok: false,
      status: 500,
      error: 'Internal Server Error',
    });
  });
});

describe('getAnalyticsEnabled / setAnalyticsEnabled', () => {
  it('defaults to true when localStorage is unset', () => {
    expect(getAnalyticsEnabled()).toBe(true);
  });

  it('returns false when user has opted out', () => {
    setAnalyticsEnabled(false);
    expect(getAnalyticsEnabled()).toBe(false);
  });

  it('returns true when user has allowed analytics', () => {
    setAnalyticsEnabled(true);
    expect(getAnalyticsEnabled()).toBe(true);
  });
});

describe('exportUserData', () => {
  it('returns { ok: true, data } on 200 with JSON body', async () => {
    const mockData = { user: {}, events: [] };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockData),
      })
    );

    const result = await exportUserData(false);

    expect(result).toEqual({ ok: true, data: mockData });
    expect(fetch).toHaveBeenCalledWith(
      '/api/account/export',
      expect.objectContaining({ credentials: 'include' })
    );
  });

  it('calls with includeStreams=true when requested', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) })
    );

    await exportUserData(true);

    expect(fetch).toHaveBeenCalledWith(
      '/api/account/export?includeStreams=true',
      expect.any(Object)
    );
  });

  it('returns { ok: false, status, error } on 4xx', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: () => Promise.resolve(JSON.stringify({ error: 'User not found' })),
      })
    );

    const result = await exportUserData(false);

    expect(result).toEqual({
      ok: false,
      status: 404,
      error: 'User not found',
    });
  });
});
