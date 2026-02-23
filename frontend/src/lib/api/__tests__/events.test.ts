import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getEvents,
  getActivityRows,
  getEvent,
  getActivityTypes,
  getDevices,
  updateActivity,
  getStreams,
  deleteEvent,
} from '../events';
import { eventDetailFixture } from '../../../test/fixtures/event-detail';
import { activityRowsFixture } from '../../../test/fixtures/activity-rows';
import { streamsLatLngFixture } from '../../../test/fixtures/streams';

describe('fixtures', () => {
  it('event detail fixture timestamps are in milliseconds', () => {
    expect(eventDetailFixture.event.startDate).toBeGreaterThan(1_000_000_000_000);
    expect(eventDetailFixture.event.endDate).toBeGreaterThan(1_000_000_000_000);
  });
});

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('getEvents', () => {
  it('includes limit=50 by default in URL', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });
    vi.stubGlobal('fetch', mockFetch);

    await getEvents();

    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('limit=50'));
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('includes startDate, endDate and limit when provided', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });
    vi.stubGlobal('fetch', mockFetch);

    await getEvents({
      startDate: 1000,
      endDate: 2000,
      limit: 10,
    });

    const url = mockFetch.mock.calls[0][0];
    expect(url).toContain('startDate=1000');
    expect(url).toContain('endDate=2000');
    expect(url).toContain('limit=10');
  });

  it('throws on non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        statusText: 'Server Error',
      })
    );

    await expect(getEvents()).rejects.toThrow(/Failed to fetch events/);
  });
});

describe('getActivityRows', () => {
  it('returns rows and total from response', async () => {
    const payload = { rows: activityRowsFixture, total: 1 };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(payload),
      })
    );

    const result = await getActivityRows();

    expect(result).toEqual(payload);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/events/activity-rows'));
  });

  it('appends activityTypes and devices to URL', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ rows: [], total: 0 }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await getActivityRows({
      activityTypes: ['running', 'cycling'],
      devices: ['Garmin'],
    });

    const url = mockFetch.mock.calls[0][0];
    expect(url).toContain('activityTypes=running');
    expect(url).toContain('activityTypes=cycling');
    expect(url).toContain('devices=Garmin');
  });

  it('does not set search param when search is blank', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ rows: [], total: 0 }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await getActivityRows({ search: '   ' });

    const url = mockFetch.mock.calls[0][0];
    expect(url).not.toContain('search=');
  });

  it('throws on non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        statusText: 'Error',
      })
    );

    await expect(getActivityRows()).rejects.toThrow(/Failed to fetch activity rows/);
  });
});

describe('getEvent', () => {
  it('returns EventDetail on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(eventDetailFixture),
      })
    );

    const result = await getEvent('evt-1');

    expect(result).toEqual(eventDetailFixture);
    expect(fetch).toHaveBeenCalledWith('/api/events/evt-1');
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

    await expect(getEvent('missing')).rejects.toThrow('Event not found');
  });

  it('throws with statusText on other error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      })
    );

    await expect(getEvent('evt-1')).rejects.toThrow(/Failed to fetch event/);
  });
});

describe('getActivityTypes', () => {
  it('returns array on success', async () => {
    const types = ['running', 'cycling'];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(types),
      })
    );

    const result = await getActivityTypes();
    expect(result).toEqual(types);
    expect(fetch).toHaveBeenCalledWith('/api/activity-types');
  });

  it('throws on non-ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        statusText: 'Error',
      })
    );

    await expect(getActivityTypes()).rejects.toThrow(/Failed to fetch activity types/);
  });
});

describe('getDevices', () => {
  it('returns array on success', async () => {
    const devices = ['Garmin'];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(devices),
      })
    );

    const result = await getDevices();
    expect(result).toEqual(devices);
    expect(fetch).toHaveBeenCalledWith('/api/devices');
  });

  it('throws on non-ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        statusText: 'Error',
      })
    );

    await expect(getDevices()).rejects.toThrow(/Failed to fetch devices/);
  });
});

describe('updateActivity', () => {
  it('sends PATCH with body and returns Activity', async () => {
    const updated = { ...eventDetailFixture.activities[0], type: 'cycling' };
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(updated),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await updateActivity('evt-1', 'act-1', {
      type: 'cycling',
    });

    expect(result).toEqual(updated);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/events/evt-1/activities/act-1',
      expect.objectContaining({
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'cycling' }),
      })
    );
  });

  it('throws "Activity not found" on 404', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      })
    );

    await expect(updateActivity('evt-1', 'act-1', { type: 'cycling' })).rejects.toThrow(
      'Activity not found'
    );
  });

  it('throws error message from response body when present', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: () => Promise.resolve({ error: 'Invalid activity type' }),
      })
    );

    await expect(updateActivity('evt-1', 'act-1', { type: 'invalid' })).rejects.toThrow(
      'Invalid activity type'
    );
  });

  it('throws with statusText when body cannot be parsed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Server Error',
        json: () => Promise.reject(new Error('parse error')),
      })
    );

    await expect(updateActivity('evt-1', 'act-1', { type: 'cycling' })).rejects.toThrow(
      /Failed to update activity/
    );
  });
});

describe('getStreams', () => {
  it('calls URL without query when types not provided', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(streamsLatLngFixture),
      })
    );

    await getStreams('evt-1', 'act-1');

    expect(fetch).toHaveBeenCalledWith('/api/events/evt-1/activities/act-1/streams');
  });

  it('appends types to URL when provided', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });
    vi.stubGlobal('fetch', mockFetch);

    await getStreams('evt-1', 'act-1', ['Heart Rate', 'Speed']);

    const url = mockFetch.mock.calls[0][0];
    expect(url).toContain('types=Heart+Rate');
    expect(url).toContain('types=Speed');
  });

  it('throws on non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        statusText: 'Error',
      })
    );

    await expect(getStreams('evt-1', 'act-1')).rejects.toThrow(/Failed to fetch streams/);
  });
});

describe('deleteEvent', () => {
  it('returns true on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
      })
    );

    const result = await deleteEvent('evt-1');

    expect(result).toBe(true);
    expect(fetch).toHaveBeenCalledWith('/api/events/evt-1', {
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

    const result = await deleteEvent('missing');

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

    await expect(deleteEvent('evt-1')).rejects.toThrow(/Failed to delete event/);
  });
});
