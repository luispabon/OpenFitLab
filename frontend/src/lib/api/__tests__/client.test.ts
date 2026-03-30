import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiFetch } from '../client';

describe('apiFetch', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('coalesces concurrent GETs to the same URL into one fetch', async () => {
    let resolveDeferred!: (r: Response) => void;
    const deferred = new Promise<Response>((r) => {
      resolveDeferred = r;
    });
    const spy = vi.spyOn(globalThis, 'fetch').mockReturnValue(deferred as Promise<Response>);
    const p1 = apiFetch('/api/events/activity-rows');
    const p2 = apiFetch('/api/events/activity-rows');
    expect(spy).toHaveBeenCalledTimes(1);
    resolveDeferred(new Response(JSON.stringify({ rows: [] }), { status: 200 }));
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    expect(r1).not.toBe(r2);
  });

  it('does not coalesce GET when init.signal is supplied', async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 204 }));
    const ac1 = new AbortController();
    const ac2 = new AbortController();
    await apiFetch('/api/foo', { signal: ac1.signal });
    await apiFetch('/api/foo', { signal: ac2.signal });
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('does not coalesce non-GET requests', async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 204 }));
    await apiFetch('/api/foo', { method: 'POST', body: '{}' });
    await apiFetch('/api/foo', { method: 'POST', body: '{}' });
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
