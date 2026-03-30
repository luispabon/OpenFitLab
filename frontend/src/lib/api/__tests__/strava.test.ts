import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchStravaStatus, fetchStravaActivities, importStravaActivities } from '../strava';
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

  it('fetchStravaStatus throws with API error message on non-OK', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Strava not configured' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    await expect(fetchStravaStatus()).rejects.toThrow('Strava not configured');
  });

  it('fetchStravaStatus uses statusText when error body is not JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('not json', { status: 502, statusText: 'Bad Gateway' })
    );
    await expect(fetchStravaStatus()).rejects.toThrow('Bad Gateway');
  });

  it('fetchStravaActivities requests list URL without query when params empty', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ activities: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    await fetchStravaActivities({});
    expect(spy).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/integrations\/strava\/activities$/),
      expect.anything()
    );
  });

  it('fetchStravaActivities passes page and perPage as query string', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ activities: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    await fetchStravaActivities({ page: 2, perPage: 10 });
    const [url] = spy.mock.calls[0];
    expect(String(url)).toContain('page=2');
    expect(String(url)).toContain('perPage=10');
  });

  it('fetchStravaActivities throws on non-OK', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Rate limited' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    await expect(fetchStravaActivities({})).rejects.toThrow('Rate limited');
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

  it('importStravaActivities includes folderId when provided', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ results: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    await importStravaActivities(['a'], 'folder-1');
    const [, init] = spy.mock.calls[0];
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      externalIds: ['a'],
      folderId: 'folder-1',
    });
  });

  it('importStravaActivities throws on 409 with body message', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Import already in progress' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    await expect(importStravaActivities(['1'], null)).rejects.toThrow('Import already in progress');
  });

  it('importStravaActivities throws on other non-OK statuses', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Bad request' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    await expect(importStravaActivities(['1'], null)).rejects.toThrow('Bad request');
  });
});
