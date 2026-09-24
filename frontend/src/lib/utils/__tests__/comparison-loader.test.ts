import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  state,
  cancelRefresh,
  load,
  refresh,
  reset,
  setSelectedActivities,
  toggleHiddenStat,
} from '../../stores/comparison-loader.svelte';
import { eventDetailFixture, eventDetailEvt2Fixture } from '../../../test/fixtures/event-detail';
import { streamsNoLocationFixture } from '../../../test/fixtures/streams';

const mockGetEvent = vi.fn();
const mockGetStreams = vi.fn();
const mockGetComparison = vi.fn();

vi.mock('../../api', () => ({
  getEvent: (...args: unknown[]) => mockGetEvent(...args),
  getStreams: (...args: unknown[]) => mockGetStreams(...args),
  getComparison: (...args: unknown[]) => mockGetComparison(...args),
}));

beforeEach(() => {
  reset();
  vi.clearAllMocks();
  mockGetStreams.mockResolvedValue([]);
  mockGetEvent.mockImplementation((id: string) =>
    Promise.resolve(id === 'evt-1' ? eventDetailFixture : eventDetailEvt2Fixture)
  );
});

describe('load() with comparisonId === "new"', () => {
  it('sets status to loaded and populates events with 2 valid event IDs', async () => {
    load('new', ['evt-1', 'evt-2']);

    await vi.waitFor(() => {
      expect(state.status).toBe('loaded');
    });

    expect(state.events).toHaveLength(2);
    expect(state.events[0].event.id).toBe('evt-1');
    expect(state.events[1].event.id).toBe('evt-2');
    expect(state.comparison).toBeNull();
    expect(mockGetEvent).toHaveBeenCalledWith('evt-1', expect.any(Object));
    expect(mockGetEvent).toHaveBeenCalledWith('evt-2', expect.any(Object));
  });

  it('sets status to error when fewer than 2 event IDs are provided', () => {
    load('new', ['evt-1']);

    expect(state.status).toBe('error');
    expect(state.error).toMatch(/at least 2 events/i);
  });

  it('sets status to error when no event IDs are provided', () => {
    load('new', []);

    expect(state.status).toBe('error');
    expect(state.error).toMatch(/at least 2 events/i);
  });

  it('clears selectedActivities and selectedStreamTypes on new load', async () => {
    // Pre-populate some state
    state.selectedStreamTypes = new Set(['Heart Rate']);

    load('new', ['evt-1', 'evt-2']);

    // selectedStreamTypes should be cleared on a new load
    expect(state.selectedStreamTypes.size).toBe(0);

    await vi.waitFor(() => {
      expect(state.status).toBe('loaded');
    });
  });
});

describe('load() with a saved comparison ID', () => {
  const comparisonId = 'cmp-1';

  beforeEach(() => {
    mockGetComparison.mockResolvedValue({
      id: comparisonId,
      name: 'Test Comparison',
      eventIds: ['evt-1', 'evt-2'],
      activityIds: ['act-1', 'act-2'],
    });
  });

  it('loads comparison then events and streams', async () => {
    load(comparisonId, []);

    await vi.waitFor(() => {
      expect(state.status).toBe('loaded');
    });

    expect(state.comparison).not.toBeNull();
    expect(state.comparison?.id).toBe(comparisonId);
    expect(state.events).toHaveLength(2);
    expect(mockGetComparison).toHaveBeenCalledWith(comparisonId, expect.any(Object));
    expect(mockGetEvent).toHaveBeenCalledWith('evt-1', expect.any(Object));
    expect(mockGetEvent).toHaveBeenCalledWith('evt-2', expect.any(Object));
  });

  it('restores selectedActivities from comparison', async () => {
    load(comparisonId, []);

    await vi.waitFor(() => {
      expect(state.status).toBe('loaded');
    });

    expect(state.selectedActivities['evt-1']).toBe('act-1');
    expect(state.selectedActivities['evt-2']).toBe('act-2');
  });

  it('sets error when comparison fetch fails', async () => {
    mockGetComparison.mockRejectedValue(new Error('Comparison not found'));

    load(comparisonId, []);

    await vi.waitFor(() => {
      expect(state.status).toBe('error');
    });

    expect(state.error).toBe('Comparison not found');
  });

  it('resets hiddenStats and referenceActivityId when loading a comparison with no settings', async () => {
    // Load comparison A with settings that set hiddenStats and referenceActivityId
    mockGetComparison.mockResolvedValueOnce({
      id: 'cmp-a',
      name: 'Comparison A',
      eventIds: ['evt-1', 'evt-2'],
      activityIds: ['act-1', 'act-2'],
      settings: {
        hiddenStats: ['Distance', 'Pace'],
        referenceActivityId: 'act-1',
        xAxisMode: 'wall-clock',
        selectedStreams: ['Heart Rate'],
      },
    });
    load('cmp-a', []);
    await vi.waitFor(() => expect(state.status).toBe('loaded'));

    expect(state.hiddenStats.size).toBe(2);
    expect(state.referenceActivityId).toBe('act-1');

    // Load comparison B with no settings — prior state must be cleared
    reset();
    mockGetComparison.mockResolvedValueOnce({
      id: 'cmp-b',
      name: 'Comparison B',
      eventIds: ['evt-1', 'evt-2'],
      activityIds: ['act-1', 'act-2'],
    });
    load('cmp-b', []);
    await vi.waitFor(() => expect(state.status).toBe('loaded'));

    expect(state.hiddenStats.size).toBe(0);
    expect(state.referenceActivityId).toBeNull();
    expect(state.xAxisMode).toBe('elapsed');
    expect(state.selectedStreamTypes.size).toBeLessThanOrEqual(1); // auto-selected at most 1
  });
});

describe('stream auto-select: Heart Rate in event 2 only → Heart Rate selected', () => {
  it('selects Heart Rate when it is present in any event streams', async () => {
    const heartRateStreams = [{ type: 'Heart Rate', data: [{ time: 0, value: 120 }] }];
    // evt-1 has no streams, evt-2 has Heart Rate
    mockGetStreams.mockImplementation((_eventId: string, activityId: string) => {
      if (activityId === 'act-2') return Promise.resolve(heartRateStreams);
      return Promise.resolve([]);
    });
    mockGetEvent.mockImplementation((id: string) =>
      Promise.resolve(id === 'evt-1' ? eventDetailFixture : eventDetailEvt2Fixture)
    );

    load('new', ['evt-1', 'evt-2']);

    await vi.waitFor(() => {
      expect(state.status).toBe('loaded');
    });

    // Heart Rate is in evt-2 streams, auto-select should pick it
    expect(state.selectedStreamTypes.has('Heart Rate')).toBe(true);
  });

  it('selects first available stream type when no Heart Rate is present', async () => {
    const speedStreams = [{ type: 'Speed', data: [{ time: 0, value: 5 }] }];
    mockGetStreams.mockResolvedValue(speedStreams);

    load('new', ['evt-1', 'evt-2']);

    await vi.waitFor(() => {
      expect(state.status).toBe('loaded');
    });

    // No Heart Rate, so first available stream type (Speed) should be selected
    expect(state.selectedStreamTypes.size).toBeGreaterThan(0);
  });

  it('does not override existing selectedStreamTypes when already set', async () => {
    mockGetComparison.mockResolvedValue({
      id: 'cmp-1',
      name: 'Saved',
      eventIds: ['evt-1', 'evt-2'],
      activityIds: ['act-1', 'act-2'],
      settings: { selectedStreams: ['Speed'], xAxisMode: 'elapsed' },
    });
    mockGetStreams.mockResolvedValue(streamsNoLocationFixture);

    load('cmp-1', []);

    await vi.waitFor(() => {
      expect(state.status).toBe('loaded');
    });

    // selectedStreamTypes set from saved comparison settings, not auto-selected
    expect(state.selectedStreamTypes.has('Speed')).toBe(true);
  });
});

describe('refresh() with a saved comparison', () => {
  const comparisonId = 'cmp-1';
  const baseComparison = {
    id: comparisonId,
    name: 'Test Comparison',
    eventIds: ['evt-1', 'evt-2'],
    activityIds: ['act-1', 'act-2'],
  };

  beforeEach(() => {
    mockGetComparison.mockResolvedValue(baseComparison);
  });

  it('does nothing for an unsaved comparison or when nothing is loaded', () => {
    refresh('new');
    refresh('');
    refresh(comparisonId);

    expect(mockGetComparison).not.toHaveBeenCalled();
    expect(state.status).toBe('idle');
  });

  it('keeps status loaded and the current view while the refresh is pending', async () => {
    load(comparisonId, []);
    await vi.waitFor(() => expect(state.status).toBe('loaded'));
    const previousComparison = state.comparison;
    const previousEvents = state.events;

    let resolveRefresh: ((value: unknown) => void) | undefined;
    mockGetComparison.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRefresh = resolve;
        })
    );

    const refreshPromise = refresh(comparisonId);

    expect(state.status).toBe('loaded');
    expect(state.error).toBeNull();
    expect(state.comparison).toBe(previousComparison);
    expect(state.events).toBe(previousEvents);

    resolveRefresh?.({ ...baseComparison, name: 'Renamed elsewhere' });
    await refreshPromise;

    expect(state.status).toBe('loaded');
    expect(state.comparison?.name).toBe('Renamed elsewhere');
  });

  it('applies settings edited elsewhere and reuses unchanged streams', async () => {
    load(comparisonId, []);
    await vi.waitFor(() => expect(state.status).toBe('loaded'));
    const streamCallsBefore = mockGetStreams.mock.calls.length;

    mockGetComparison.mockResolvedValue({
      ...baseComparison,
      settings: {
        xAxisMode: 'wall-clock',
        selectedStreams: ['Speed'],
        hiddenStats: ['Distance'],
        referenceActivityId: 'act-2',
      },
    });

    await refresh(comparisonId);

    expect(state.status).toBe('loaded');
    expect(state.xAxisMode).toBe('wall-clock');
    expect(Array.from(state.selectedStreamTypes)).toEqual(['Speed']);
    expect(Array.from(state.hiddenStats)).toEqual(['Distance']);
    expect(state.referenceActivityId).toBe('act-2');
    expect(mockGetStreams.mock.calls.length).toBe(streamCallsBefore);
  });

  it('preserves a still-valid activity selection and picks one for added events', async () => {
    const evt2WithExtraActivity = {
      ...eventDetailEvt2Fixture,
      activities: [
        eventDetailEvt2Fixture.activities[0],
        { ...eventDetailEvt2Fixture.activities[0], id: 'act-2b' },
      ],
    };
    const evt3WithActivity = {
      ...eventDetailFixture,
      event: { ...eventDetailFixture.event, id: 'evt-3' },
      activities: [{ ...eventDetailFixture.activities[0], id: 'act-3', eventID: 'evt-3' }],
    };
    mockGetEvent.mockImplementation((id: string) => {
      if (id === 'evt-2') return Promise.resolve(evt2WithExtraActivity);
      if (id === 'evt-3') return Promise.resolve(evt3WithActivity);
      return Promise.resolve(eventDetailFixture);
    });

    load(comparisonId, []);
    await vi.waitFor(() => expect(state.status).toBe('loaded'));

    // Local choice: second activity of evt-2.
    setSelectedActivities((prev) => ({ ...prev, 'evt-2': 'act-2b' }));

    // Another session removes evt-1 and adds evt-3.
    mockGetComparison.mockResolvedValue({
      ...baseComparison,
      eventIds: ['evt-2', 'evt-3'],
      activityIds: ['act-2b', 'act-3'],
    });

    await refresh(comparisonId);

    expect(state.selectedActivities).toEqual({ 'evt-2': 'act-2b', 'evt-3': 'act-3' });
  });

  it('keeps the loaded comparison and state when the refresh fails', async () => {
    load(comparisonId, []);
    await vi.waitFor(() => expect(state.status).toBe('loaded'));
    const previousComparison = state.comparison;
    const previousEvents = state.events;

    mockGetComparison.mockRejectedValue(new Error('Network error'));
    await refresh(comparisonId);

    expect(state.status).toBe('loaded');
    expect(state.error).toBeNull();
    expect(state.comparison).toBe(previousComparison);
    expect(state.events).toBe(previousEvents);
  });

  it('keeps the loaded view when a refresh returns fewer than two events', async () => {
    load(comparisonId, []);
    await vi.waitFor(() => expect(state.status).toBe('loaded'));
    const previousComparison = state.comparison;
    const previousEvents = state.events;
    const previousStreams = state.streamsByEventId;

    mockGetComparison.mockResolvedValue({
      ...baseComparison,
      name: 'Half deleted elsewhere',
      eventIds: ['evt-1'],
      activityIds: ['act-1'],
      settings: { xAxisMode: 'wall-clock', hiddenStats: ['Distance'] },
    });

    await refresh(comparisonId);

    expect(state.status).toBe('loaded');
    expect(state.error).toBeNull();
    expect(state.comparison).toBe(previousComparison);
    expect(state.events).toBe(previousEvents);
    expect(state.streamsByEventId).toBe(previousStreams);
    expect(state.xAxisMode).toBe('elapsed');
    expect(state.hiddenStats.size).toBe(0);
  });

  it('keeps the whole loaded view when changed membership cannot be loaded', async () => {
    mockGetComparison.mockResolvedValue({
      ...baseComparison,
      settings: {
        xAxisMode: 'wall-clock',
        hiddenStats: ['Distance'],
        selectedStreams: ['Speed'],
        referenceActivityId: 'act-2',
      },
    });
    load(comparisonId, []);
    await vi.waitFor(() => expect(state.status).toBe('loaded'));

    const previousComparison = state.comparison;
    const previousEvents = state.events;
    const previousStreams = state.streamsByEventId;
    const previousActivities = state.selectedActivities;
    const previousStreamTypes = state.selectedStreamTypes;
    expect(state.xAxisMode).toBe('wall-clock');
    expect(state.referenceActivityId).toBe('act-2');

    // Another session swapped a member; the replacement event fails to load.
    mockGetComparison.mockResolvedValue({
      ...baseComparison,
      name: 'Changed elsewhere',
      eventIds: ['evt-2', 'evt-3'],
      activityIds: ['act-2', 'act-3'],
      settings: { xAxisMode: 'elapsed', hiddenStats: [], selectedStreams: [] },
    });
    mockGetEvent.mockImplementation((id: string) =>
      id === 'evt-3'
        ? Promise.reject(new Error('Event not found'))
        : Promise.resolve(eventDetailEvt2Fixture)
    );

    await refresh(comparisonId);

    expect(state.status).toBe('loaded');
    expect(state.error).toBeNull();
    expect(state.comparison).toBe(previousComparison);
    expect(state.events).toBe(previousEvents);
    expect(state.streamsByEventId).toBe(previousStreams);
    expect(state.selectedActivities).toBe(previousActivities);
    expect(state.selectedStreamTypes).toBe(previousStreamTypes);
    expect(state.xAxisMode).toBe('wall-clock');
    expect(state.referenceActivityId).toBe('act-2');
    expect(Array.from(state.hiddenStats)).toEqual(['Distance']);
  });

  it('does not commit a refresh response that a local edit cancelled', async () => {
    load(comparisonId, []);
    await vi.waitFor(() => expect(state.status).toBe('loaded'));
    const previousComparison = state.comparison;

    let resolveRefresh: ((value: unknown) => void) | undefined;
    mockGetComparison.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRefresh = resolve;
        })
    );
    const refreshPromise = refresh(comparisonId);

    // A local edit starts while the refresh is still pending.
    cancelRefresh();
    toggleHiddenStat('Distance');

    resolveRefresh?.({
      ...baseComparison,
      name: 'Stale refresh',
      settings: { xAxisMode: 'wall-clock', hiddenStats: [] },
    });
    await refreshPromise;

    expect(state.comparison).toBe(previousComparison);
    expect(state.xAxisMode).toBe('elapsed');
    expect(Array.from(state.hiddenStats)).toEqual(['Distance']);
  });

  it('lets a newer refresh supersede an earlier one that resolves late', async () => {
    load(comparisonId, []);
    await vi.waitFor(() => expect(state.status).toBe('loaded'));

    let resolveFirstRefresh: ((value: unknown) => void) | undefined;
    mockGetComparison.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirstRefresh = resolve;
        })
    );
    const firstRefresh = refresh(comparisonId);

    mockGetComparison.mockImplementationOnce(() =>
      Promise.resolve({ ...baseComparison, name: 'Newer refresh' })
    );
    await refresh(comparisonId);

    expect(state.comparison?.name).toBe('Newer refresh');

    // The superseded refresh resolves after the newer one already committed.
    resolveFirstRefresh?.({ ...baseComparison, name: 'Stale refresh' });
    await firstRefresh;

    expect(state.status).toBe('loaded');
    expect(state.comparison?.name).toBe('Newer refresh');
  });

  it('ignores a refresh response that arrives after another comparison loaded', async () => {
    load(comparisonId, []);
    await vi.waitFor(() => expect(state.status).toBe('loaded'));

    let resolveRefresh: ((value: unknown) => void) | undefined;
    mockGetComparison.mockImplementation((id: string) => {
      if (id === comparisonId) {
        return new Promise((resolve) => {
          resolveRefresh = resolve;
        });
      }
      return Promise.resolve({
        id: 'cmp-2',
        name: 'Other Comparison',
        eventIds: ['evt-1', 'evt-2'],
        activityIds: ['act-1', 'act-2'],
      });
    });

    const refreshPromise = refresh(comparisonId);
    load('cmp-2', []);
    await vi.waitFor(() => expect(state.comparison?.id).toBe('cmp-2'));

    resolveRefresh?.({ ...baseComparison, name: 'Stale refresh' });
    await refreshPromise;

    expect(state.status).toBe('loaded');
    expect(state.comparison?.id).toBe('cmp-2');
    expect(state.comparison?.name).toBe('Other Comparison');
  });
});

describe('reset()', () => {
  it('clears all state back to initial values', async () => {
    // Load something first
    load('new', ['evt-1', 'evt-2']);
    await vi.waitFor(() => expect(state.status).toBe('loaded'));

    reset();

    expect(state.status).toBe('idle');
    expect(state.comparison).toBeNull();
    expect(state.events).toHaveLength(0);
    expect(Object.keys(state.streamsByEventId)).toHaveLength(0);
    expect(state.error).toBeNull();
    expect(Object.keys(state.selectedActivities)).toHaveLength(0);
    expect(state.selectedStreamTypes.size).toBe(0);
    expect(state.xAxisMode).toBe('elapsed');
    expect(state.hiddenStats.size).toBe(0);
    expect(state.referenceActivityId).toBeNull();
  });

  it('allows a new load after reset', async () => {
    load('new', ['evt-1', 'evt-2']);
    await vi.waitFor(() => expect(state.status).toBe('loaded'));

    reset();

    load('new', ['evt-1', 'evt-2']);
    await vi.waitFor(() => expect(state.status).toBe('loaded'));

    expect(state.events).toHaveLength(2);
  });
});
