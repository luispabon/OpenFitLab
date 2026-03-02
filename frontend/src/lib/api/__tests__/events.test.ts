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
  uploadFiles,
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

    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('limit=50'), expect.any(Object));
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
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/events/activity-rows'),
      expect.any(Object)
    );
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

  it('sets search param with trimmed value when search is non-blank', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ rows: [], total: 0 }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await getActivityRows({ search: '  run  ' });

    const url = mockFetch.mock.calls[0][0];
    expect(url).toContain('search=run');
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
    expect(fetch).toHaveBeenCalledWith('/api/events/evt-1', expect.any(Object));
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

  it('passes signal to fetch when options.signal provided', async () => {
    const controller = new AbortController();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(eventDetailFixture),
      })
    );

    await getEvent('evt-1', { signal: controller.signal });

    expect(fetch).toHaveBeenCalledWith(
      '/api/events/evt-1',
      expect.objectContaining({ signal: controller.signal })
    );
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
    expect(fetch).toHaveBeenCalledWith('/api/activity-types', expect.any(Object));
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
    expect(fetch).toHaveBeenCalledWith('/api/devices', expect.any(Object));
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

    expect(fetch).toHaveBeenCalledWith(
      '/api/events/evt-1/activities/act-1/streams',
      expect.objectContaining({ credentials: 'include' })
    );
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

  it('passes signal to fetch when options.signal provided', async () => {
    const controller = new AbortController();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(streamsLatLngFixture),
      })
    );

    await getStreams('evt-1', 'act-1', undefined, { signal: controller.signal });

    expect(fetch).toHaveBeenCalledWith(
      '/api/events/evt-1/activities/act-1/streams',
      expect.objectContaining({ signal: controller.signal })
    );
  });
});

describe('uploadFiles', () => {
  function createXHRMock() {
    const loadListeners: (() => void)[] = [];
    const errorListeners: (() => void)[] = [];
    const abortListeners: (() => void)[] = [];
    const progressListeners: ((e: ProgressEvent) => void)[] = [];
    const xhr = {
      open: vi.fn(),
      send: vi.fn(),
      withCredentials: false,
      status: 200,
      statusText: 'OK',
      responseText: '{}',
      upload: {
        addEventListener: vi.fn((ev: string, fn: (e: ProgressEvent) => void) => {
          if (ev === 'progress') progressListeners.push(fn);
        }),
      },
      addEventListener: vi.fn((ev: string, fn: () => void) => {
        if (ev === 'load') loadListeners.push(fn);
        if (ev === 'error') errorListeners.push(fn);
        if (ev === 'abort') abortListeners.push(fn);
      }),
      _fireLoad: () => loadListeners.forEach((fn) => fn()),
      _fireError: () => errorListeners.forEach((fn) => fn()),
      _fireAbort: () => abortListeners.forEach((fn) => fn()),
      _fireProgress: (e: ProgressEvent) => progressListeners.forEach((fn) => fn(e)),
    };
    return xhr;
  }

  it('resolves with response and calls onProgress(100) on success', async () => {
    const xhrInstances: ReturnType<typeof createXHRMock>[] = [];
    vi.stubGlobal('XMLHttpRequest', function (this: ReturnType<typeof createXHRMock>) {
      const xhr = createXHRMock();
      xhrInstances.push(xhr);
      return xhr;
    });

    const onProgress = vi.fn();
    const response = { results: [{ id: 'ev-1', event: {}, activities: [] }] };
    const p = uploadFiles([new File(['x'], 'a.gpx')], onProgress);

    await vi.waitFor(() => expect(xhrInstances.length).toBe(1));
    const xhr = xhrInstances[0];
    xhr.status = 200;
    xhr.responseText = JSON.stringify(response);
    xhr._fireProgress({ lengthComputable: true, loaded: 50, total: 100 } as ProgressEvent);
    xhr._fireProgress({ lengthComputable: true, loaded: 100, total: 100 } as ProgressEvent);
    xhr._fireLoad();

    const result = await p;
    expect(result).toEqual(response);
    expect(onProgress).toHaveBeenCalledWith(100);
    expect(xhr.open).toHaveBeenCalledWith('POST', '/api/events');
    expect(xhr.withCredentials).toBe(true);
  });

  it('does not call onProgress when not provided', async () => {
    const xhrInstances: ReturnType<typeof createXHRMock>[] = [];
    vi.stubGlobal('XMLHttpRequest', function (this: ReturnType<typeof createXHRMock>) {
      const xhr = createXHRMock();
      xhrInstances.push(xhr);
      return xhr;
    });

    const p = uploadFiles([new File(['x'], 'a.gpx')]);

    await vi.waitFor(() => expect(xhrInstances.length).toBe(1));
    const xhr = xhrInstances[0];
    xhr.status = 200;
    xhr.responseText = JSON.stringify({ results: [] });
    xhr._fireLoad();

    await p;
    expect(xhr.upload.addEventListener).toHaveBeenCalledWith('progress', expect.any(Function));
  });

  it('rejects with error message from JSON body on 4xx/5xx', async () => {
    const xhrInstances: ReturnType<typeof createXHRMock>[] = [];
    vi.stubGlobal('XMLHttpRequest', function (this: ReturnType<typeof createXHRMock>) {
      const xhr = createXHRMock();
      xhrInstances.push(xhr);
      return xhr;
    });

    const p = uploadFiles([new File(['x'], 'a.gpx')]);

    await vi.waitFor(() => expect(xhrInstances.length).toBe(1));
    const xhr = xhrInstances[0];
    xhr.status = 400;
    xhr.statusText = 'Bad Request';
    xhr.responseText = JSON.stringify({ error: 'Invalid file type' });
    xhr._fireLoad();

    await expect(p).rejects.toThrow('Invalid file type');
  });

  it('rejects with statusText when error response has non-JSON body', async () => {
    const xhrInstances: ReturnType<typeof createXHRMock>[] = [];
    vi.stubGlobal('XMLHttpRequest', function (this: ReturnType<typeof createXHRMock>) {
      const xhr = createXHRMock();
      xhrInstances.push(xhr);
      return xhr;
    });

    const p = uploadFiles([new File(['x'], 'a.gpx')]);

    await vi.waitFor(() => expect(xhrInstances.length).toBe(1));
    const xhr = xhrInstances[0];
    xhr.status = 500;
    xhr.statusText = 'Internal Server Error';
    xhr.responseText = 'plain text error';
    xhr._fireLoad();

    await expect(p).rejects.toThrow('Internal Server Error');
  });

  it('rejects with "Failed to parse response" when success response is invalid JSON', async () => {
    const xhrInstances: ReturnType<typeof createXHRMock>[] = [];
    vi.stubGlobal('XMLHttpRequest', function (this: ReturnType<typeof createXHRMock>) {
      const xhr = createXHRMock();
      xhrInstances.push(xhr);
      return xhr;
    });

    const p = uploadFiles([new File(['x'], 'a.gpx')]);

    await vi.waitFor(() => expect(xhrInstances.length).toBe(1));
    const xhr = xhrInstances[0];
    xhr.status = 200;
    xhr.responseText = 'not json';
    xhr._fireLoad();

    await expect(p).rejects.toThrow('Failed to parse response');
  });

  it('rejects with "Network error during upload" on error event', async () => {
    const xhrInstances: ReturnType<typeof createXHRMock>[] = [];
    vi.stubGlobal('XMLHttpRequest', function (this: ReturnType<typeof createXHRMock>) {
      const xhr = createXHRMock();
      xhrInstances.push(xhr);
      return xhr;
    });

    const p = uploadFiles([new File(['x'], 'a.gpx')]);

    await vi.waitFor(() => expect(xhrInstances.length).toBe(1));
    const xhr = xhrInstances[0];
    xhr._fireError();

    await expect(p).rejects.toThrow('Network error during upload');
  });

  it('rejects with "Upload aborted" on abort event', async () => {
    const xhrInstances: ReturnType<typeof createXHRMock>[] = [];
    vi.stubGlobal('XMLHttpRequest', function (this: ReturnType<typeof createXHRMock>) {
      const xhr = createXHRMock();
      xhrInstances.push(xhr);
      return xhr;
    });

    const p = uploadFiles([new File(['x'], 'a.gpx')]);

    await vi.waitFor(() => expect(xhrInstances.length).toBe(1));
    const xhr = xhrInstances[0];
    xhr._fireAbort();

    await expect(p).rejects.toThrow('Upload aborted');
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
    expect(fetch).toHaveBeenCalledWith(
      '/api/events/evt-1',
      expect.objectContaining({ method: 'DELETE', credentials: 'include' })
    );
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
