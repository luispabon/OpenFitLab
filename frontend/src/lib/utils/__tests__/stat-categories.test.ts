import { describe, it, expect } from 'vitest';
import { parseStat } from '../stat-parsing';
import {
  metricAggregationKey,
  metricAggregationKeyNormalized,
  keepStatByPreferredUnit,
  findStatByMetric,
  selectKeyMetrics,
  getGroupedDeduplicatedStats,
  getComparisonStatTypes,
  type StatEntry,
} from '../stat-categories';
import type { EventDetail } from '../../types';

describe('metricAggregationKey', () => {
  it('returns aggregation + metric when aggregation present', () => {
    expect(
      metricAggregationKey({
        metric: 'Speed',
        aggregation: 'Average',
        unitVariant: null,
        original: 'Average Speed',
      })
    ).toBe('Average Speed');
  });
  it('returns metric only when no aggregation', () => {
    expect(
      metricAggregationKey({
        metric: 'Distance',
        aggregation: null,
        unitVariant: null,
        original: 'Distance',
      })
    ).toBe('Distance');
  });
});

describe('metricAggregationKeyNormalized', () => {
  it('returns lower case key', () => {
    expect(metricAggregationKeyNormalized(parseStat('Average Speed'))).toBe('average speed');
  });
});

describe('keepStatByPreferredUnit', () => {
  it('returns true when no unit variant (base)', () => {
    expect(
      keepStatByPreferredUnit({
        metric: 'Duration',
        aggregation: null,
        unitVariant: null,
        original: 'Duration',
      })
    ).toBe(true);
  });
  it('returns true for Speed with preferred Kilometers per Hour', () => {
    expect(
      keepStatByPreferredUnit({
        metric: 'Speed',
        aggregation: 'Average',
        unitVariant: 'Kilometers per Hour',
        original: 'Average Speed in Kilometers per Hour',
      })
    ).toBe(true);
  });
  it('returns false for Speed with Knots', () => {
    expect(
      keepStatByPreferredUnit({
        metric: 'Speed',
        aggregation: 'Average',
        unitVariant: 'Knots',
        original: 'Average Speed in Knots',
      })
    ).toBe(false);
  });
  it('returns false for Distance with unit variant (preferred is null)', () => {
    expect(
      keepStatByPreferredUnit({
        metric: 'Distance',
        aggregation: null,
        unitVariant: 'Meters',
        original: 'Distance in Meters',
      })
    ).toBe(false);
  });
  it('returns false for unknown metric with unit variant', () => {
    expect(
      keepStatByPreferredUnit({
        metric: 'Banana',
        aggregation: null,
        unitVariant: 'Foo',
        original: 'Banana in Foo',
      })
    ).toBe(false);
  });
  it('returns true for Speed with lowercase preferred match', () => {
    expect(
      keepStatByPreferredUnit({
        metric: 'Speed',
        aggregation: 'Average',
        unitVariant: 'kilometers per hour',
        original: 'Average Speed in kilometers per hour',
      })
    ).toBe(true);
  });
});

describe('findStatByMetric', () => {
  it('finds stat by metric name', () => {
    const result = findStatByMetric({ Duration: 3600 }, 'Duration');
    expect(result).toEqual({ statType: 'Duration', value: 3600 });
  });
  it('is case-insensitive for metric', () => {
    const result = findStatByMetric({ duration: 3600 }, 'Duration');
    expect(result).toEqual({ statType: 'duration', value: 3600 });
  });
  it('filters by aggregation when provided', () => {
    const stats = {
      'Average Speed': 10,
      'Maximum Speed': 20,
    };
    const result = findStatByMetric(stats, 'Speed', 'Average');
    expect(result).toEqual({ statType: 'Average Speed', value: 10 });
  });
  it('returns null when not found', () => {
    expect(findStatByMetric({ Duration: 100 }, 'Cadence')).toBeNull();
  });
  it('finds without aggregation arg (any aggregation)', () => {
    const result = findStatByMetric({ 'Average Speed': 10 }, 'Speed');
    expect(result).toEqual({ statType: 'Average Speed', value: 10 });
  });
});

describe('selectKeyMetrics', () => {
  it('returns running key metrics when activity type contains run', () => {
    const stats = {
      Distance: 5000,
      Duration: 3600,
      'Average Speed in Kilometers per Hour': 12,
      'Average Heart Rate': 145,
      Ascent: 100,
    };
    const result = selectKeyMetrics(stats, 'Trail Running');
    expect(result.length).toBeGreaterThan(0);
    expect(result.map((e) => e.statType)).toContain('Distance');
    expect(result.map((e) => e.statType)).toContain('Duration');
  });
  it('returns cycling key metrics for bike', () => {
    const stats = {
      Distance: 20000,
      Duration: 3600,
      'Average Power': 200,
      'Average Speed in Kilometers per Hour': 25,
      'Average Heart Rate': 140,
    };
    const result = selectKeyMetrics(stats, 'Mountain Biking');
    expect(result.length).toBeGreaterThanOrEqual(3);
    expect(result.map((e) => e.statType)).toContain('Distance');
    expect(result.map((e) => e.statType)).toContain('Duration');
  });
  it('returns swimming key metrics for swim', () => {
    const stats = {
      Distance: 1500,
      Duration: 1800,
      'Average Speed in Kilometers per Hour': 3,
      'Average Heart Rate': 130,
    };
    const result = selectKeyMetrics(stats, 'Swimming');
    expect(result.length).toBeGreaterThan(0);
  });
  it('uses default keys for unknown activity type', () => {
    const stats = {
      Distance: 1000,
      Duration: 600,
      'Average Speed in Kilometers per Hour': 6,
      'Average Heart Rate': 120,
      Energy: 50,
    };
    const result = selectKeyMetrics(stats, '');
    expect(result.length).toBeGreaterThan(0);
  });
  it('omits stat not present in stats', () => {
    const stats = { Duration: 3600 };
    const result = selectKeyMetrics(stats, 'Running');
    expect(result.find((e) => e.statType === 'Ascent')).toBeUndefined();
  });
});

describe('getGroupedDeduplicatedStats', () => {
  it('returns empty array for empty entries', () => {
    expect(getGroupedDeduplicatedStats([])).toEqual([]);
  });
  it('returns one category for single Time entry', () => {
    const entries: StatEntry[] = [{ statType: 'Duration', value: '1:00:00', unit: '' }];
    const result = getGroupedDeduplicatedStats(entries);
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('Time');
    expect(result[0].entries).toHaveLength(1);
  });
  it('returns categories in stable order', () => {
    const entries: StatEntry[] = [
      { statType: 'Speed', value: '10', unit: 'km/h' },
      { statType: 'Duration', value: '1:00', unit: '' },
      { statType: 'Distance', value: '5km', unit: '' },
    ];
    const result = getGroupedDeduplicatedStats(entries);
    const categories = result.map((r) => r.category);
    expect(categories.indexOf('Time')).toBeLessThan(categories.indexOf('Distance'));
    expect(categories.indexOf('Distance')).toBeLessThan(categories.indexOf('Speed'));
  });
  it('filters out entries without stat icon', () => {
    const entries: StatEntry[] = [{ statType: 'Banana', value: '42', unit: '' }];
    const result = getGroupedDeduplicatedStats(entries);
    expect(result).toHaveLength(0);
  });
  it('deduplicates by metric+aggregation (prefers one unit)', () => {
    const entries: StatEntry[] = [
      { statType: 'Average Speed in Kilometers per Hour', value: '25', unit: 'km/h' },
      { statType: 'Average Speed in Knots', value: '13', unit: 'knots' },
    ];
    const result = getGroupedDeduplicatedStats(entries);
    expect(result.length).toBeGreaterThanOrEqual(1);
    const speedGroup = result.find((r) => r.category === 'Speed');
    expect(speedGroup).toBeDefined();
    expect(speedGroup!.entries).toHaveLength(1);
    expect(speedGroup!.entries[0].statType).toContain('Kilometers per Hour');
  });
  it('skips entries that do not match preferred unit (continue branch)', () => {
    const entries: StatEntry[] = [
      { statType: 'Average Speed in Knots', value: '13', unit: 'knots' },
    ];
    const result = getGroupedDeduplicatedStats(entries);
    const speedGroup = result.find((r) => r.category === 'Speed');
    expect(speedGroup).toBeUndefined();
  });
});

describe('selectKeyMetrics preferred speed', () => {
  it('prefers Average Speed in Kilometers per Hour when both Knots and km/h exist (line 203 branch)', () => {
    const stats = {
      Distance: 5000,
      Duration: 3600,
      'Average Speed in Knots': 6.5,
      'Average Speed in Kilometers per Hour': 12,
      'Average Heart Rate': 145,
      Ascent: 100,
    };
    const result = selectKeyMetrics(stats, 'Running');
    const speedEntry = result.find((e) => e.statType.includes('Speed'));
    expect(speedEntry).toBeDefined();
    expect(speedEntry!.statType).toContain('Kilometers per Hour');
  });
});

type ActivityStats = Record<
  string,
  number | string | number[] | string[] | Record<string, unknown>
>;

function makeEvent(id: string, activityStats: ActivityStats): EventDetail {
  return {
    event: { id, name: id, startDate: 0, stats: {} },
    activities: [{ id: `act-${id}`, eventID: id, stats: activityStats }],
  };
}

describe('getComparisonStatTypes', () => {
  it('includes stat when both events have it', () => {
    const events = [makeEvent('e1', { Duration: 3600 }), makeEvent('e2', { Duration: 1800 })];
    const selectedActivities = { e1: 'act-e1', e2: 'act-e2' };
    const result = getComparisonStatTypes(events, selectedActivities, new Set());
    expect(result).toContain('Duration');
  });

  it('excludes stat present in only one event', () => {
    const events = [makeEvent('e1', { Duration: 3600 }), makeEvent('e2', { Distance: 5000 })];
    const selectedActivities = { e1: 'act-e1', e2: 'act-e2' };
    const result = getComparisonStatTypes(events, selectedActivities, new Set());
    expect(result).not.toContain('Duration');
    expect(result).not.toContain('Distance');
  });

  it('excludes stat when key is in hiddenStats', () => {
    const events = [makeEvent('e1', { Duration: 3600 }), makeEvent('e2', { Duration: 1800 })];
    const selectedActivities = { e1: 'act-e1', e2: 'act-e2' };
    const result = getComparisonStatTypes(events, selectedActivities, new Set(['Duration']));
    expect(result).not.toContain('Duration');
  });

  it('deduplicates by preferred unit variant, keeping only preferred', () => {
    const stats = {
      'Average Speed in Kilometers per Hour': 12,
      'Average Speed in Knots': 6,
    };
    const events = [makeEvent('e1', stats), makeEvent('e2', stats)];
    const selectedActivities = { e1: 'act-e1', e2: 'act-e2' };
    const result = getComparisonStatTypes(events, selectedActivities, new Set());
    const speedEntries = result.filter((t) => t.includes('Speed'));
    expect(speedEntries).toHaveLength(1);
    expect(speedEntries[0]).toContain('Kilometers per Hour');
  });

  it('returns empty array for empty events', () => {
    const result = getComparisonStatTypes([], {}, new Set());
    expect(result).toEqual([]);
  });

  it('excludes stats with empty string values', () => {
    const events = [makeEvent('e1', { Duration: '' }), makeEvent('e2', { Duration: '' })];
    const selectedActivities = { e1: 'act-e1', e2: 'act-e2' };
    const result = getComparisonStatTypes(events, selectedActivities, new Set());
    expect(result).not.toContain('Duration');
  });
});
