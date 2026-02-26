import { describe, it, expect, vi } from 'vitest';
import { apiFetch } from '../../api/client';

describe('apiFetch', () => {
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

  it('sets user to null on 401', async () => {
    const mockRes = new Response('', { status: 401 });
    vi.spyOn(globalThis as unknown as { fetch: typeof fetch }, 'fetch').mockResolvedValueOnce(
      mockRes as unknown as Response
    );
    const res = await apiFetch('/api/secret');
    expect(res.status).toBe(401);
  });
});
