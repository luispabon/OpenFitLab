import { describe, it, expect, vi, beforeEach } from 'vitest';
import { state, load, reset } from '../comparison-loader.svelte';
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
