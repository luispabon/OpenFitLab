import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiFetch } from '../../api/client';
import { state as authState } from '../../stores/auth.svelte';

describe('apiFetch', () => {
  beforeEach(() => {
    authState.csrfToken = null;
  });

  it('includes credentials and propagates response', async () => {
    const mockRes = new Response(JSON.stringify({ ok: true }), { status: 200 });
    const spy = vi
      .spyOn(globalThis as unknown as { fetch: typeof fetch }, 'fetch')
      .mockResolvedValueOnce(mockRes as unknown as Response);
    const res = await apiFetch('/api/test', { method: 'GET' });
    expect(spy).toHaveBeenCalledWith(
      '/api/test',
      expect.objectContaining({ credentials: 'include', method: 'GET' })
    );
    expect(res).toBe(mockRes);
  });

  it('sends CSRF-Token header for POST when csrfToken is set', async () => {
    authState.csrfToken = 'secret-token';
    const mockRes = new Response('', { status: 201 });
    const spy = vi
      .spyOn(globalThis as unknown as { fetch: typeof fetch }, 'fetch')
      .mockResolvedValueOnce(mockRes as unknown as Response);
    await apiFetch('/api/events', { method: 'POST', body: '{}' });
    const call = spy.mock.calls.find((c) => c[0] === '/api/events');
    expect(call).toBeDefined();
    const headers = call![1]?.headers as Headers;
    expect(headers.get('CSRF-Token')).toBe('secret-token');
  });

  it('sets user to null on 401', async () => {
    const mockRes = new Response('', { status: 401 });
    vi.spyOn(globalThis as unknown as { fetch: typeof fetch }, 'fetch').mockResolvedValueOnce(
      mockRes as unknown as Response
    );
    const res = await apiFetch('/api/secret');
    expect(res.status).toBe(401);
  });

  it('clears csrfToken on 403', async () => {
    authState.csrfToken = 'old-token';
    const mockRes = new Response('', { status: 403 });
    vi.spyOn(globalThis as unknown as { fetch: typeof fetch }, 'fetch').mockResolvedValueOnce(
      mockRes as unknown as Response
    );
    await apiFetch('/api/events', { method: 'POST' });
    expect(authState.csrfToken).toBeNull();
  });
});
