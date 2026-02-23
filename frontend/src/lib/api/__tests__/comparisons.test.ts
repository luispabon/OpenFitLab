import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getComparisonCandidates,
  getComparisons,
  getComparison,
  createComparison,
  deleteComparison,
} from '../comparisons';
import {
  comparisonFixture,
  comparisonWithSettingsFixture,
} from '../../../test/fixtures/comparisons';
import { eventSummaryFixture } from '../../../test/fixtures/event-detail';

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('getComparisonCandidates', () => {
  it('returns array and calls correct URL', async () => {
    const candidates = [eventSummaryFixture];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(candidates),
      })
    );

    const result = await getComparisonCandidates('evt-1');

    expect(result).toEqual(candidates);
    expect(fetch).toHaveBeenCalledWith('/api/events/evt-1/candidates');
  });

  it('throws "Event not found" on 404', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      })
    );

    await expect(getComparisonCandidates('missing')).rejects.toThrow('Event not found');
  });

  it('throws on other error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Server Error',
      })
    );

    await expect(getComparisonCandidates('evt-1')).rejects.toThrow(
      /Failed to fetch comparison candidates/
    );
  });
});

describe('getComparisons', () => {
  it('returns array on success', async () => {
    const list = [comparisonFixture];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(list),
      })
    );

    const result = await getComparisons();

    expect(result).toEqual(list);
    expect(fetch).toHaveBeenCalledWith('/api/comparisons');
  });

  it('throws on non-ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        statusText: 'Error',
      })
    );

    await expect(getComparisons()).rejects.toThrow(/Failed to fetch comparisons/);
  });
});

describe('getComparison', () => {
  it('returns Comparison on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(comparisonFixture),
      })
    );

    const result = await getComparison('cmp-1');

    expect(result).toEqual(comparisonFixture);
    expect(fetch).toHaveBeenCalledWith('/api/comparisons/cmp-1');
  });

  it('throws "Comparison not found" on 404', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      })
    );

    await expect(getComparison('missing')).rejects.toThrow('Comparison not found');
  });

  it('throws on other error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Server Error',
      })
    );

    await expect(getComparison('cmp-1')).rejects.toThrow(/Failed to fetch comparison/);
  });
});

describe('createComparison', () => {
  it('sends POST with name, eventIds and optional settings', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(comparisonFixture),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await createComparison('Run vs Ride', ['evt-1', 'evt-2']);

    expect(result).toEqual(comparisonFixture);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/comparisons',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Run vs Ride',
          eventIds: ['evt-1', 'evt-2'],
          settings: undefined,
        }),
      })
    );
  });

  it('includes settings in body when provided', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(comparisonWithSettingsFixture),
    });
    vi.stubGlobal('fetch', mockFetch);

    await createComparison('Detailed', ['evt-1'], {
      selectedStreams: ['Heart Rate'],
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.settings).toEqual({ selectedStreams: ['Heart Rate'] });
  });

  it('throws error from response body when present', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        statusText: 'Bad Request',
        json: () => Promise.resolve({ error: 'Duplicate name' }),
      })
    );

    await expect(createComparison('Duplicate', ['evt-1'])).rejects.toThrow('Duplicate name');
  });

  it('throws statusText when body has no error key', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({}),
      })
    );

    await expect(createComparison('Test', ['evt-1'])).rejects.toThrow(
      /Failed to create comparison/
    );
  });
});

describe('deleteComparison', () => {
  it('returns true on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
      })
    );

    const result = await deleteComparison('cmp-1');

    expect(result).toBe(true);
    expect(fetch).toHaveBeenCalledWith('/api/comparisons/cmp-1', {
      method: 'DELETE',
    });
  });

  it('returns false on 404', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      })
    );

    const result = await deleteComparison('missing');

    expect(result).toBe(false);
  });

  it('throws on other error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Server Error',
      })
    );

    await expect(deleteComparison('cmp-1')).rejects.toThrow(/Failed to delete comparison/);
  });
});
