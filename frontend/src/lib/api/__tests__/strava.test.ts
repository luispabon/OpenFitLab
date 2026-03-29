import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchStravaStatus, importStravaActivities } from '../strava';
import { state as authState } from '../../stores/auth.svelte';

describe('strava API', () => {
  beforeEach(() => {
    authState.csrfToken = 'csrf-test';
    vi.restoreAllMocks();
  });

  it('fetchStravaStatus returns JSON on success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ configured: true, connected: false }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    const st = await fetchStravaStatus();
    expect(st.configured).toBe(true);
    expect(st.connected).toBe(false);
  });

  it('importStravaActivities sends Idempotency-Key and body', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ results: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    await importStravaActivities(['1', '2'], null);
    expect(spy).toHaveBeenCalledTimes(1);
    const [, init] = spy.mock.calls[0];
    const headers = (init as RequestInit).headers as Headers;
    expect(headers.get('Idempotency-Key')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
    expect(headers.get('CSRF-Token')).toBe('csrf-test');
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ externalIds: ['1', '2'] });
  });
});
