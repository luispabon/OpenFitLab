import { describe, it, expect } from 'vitest';
import {
  isTimeStat,
  isDistanceStat,
  isSpeedStat,
  roundTo2Decimals,
  formatDistance,
  formatDuration,
  formatStatValue,
} from '../stat-formatting';

describe('isTimeStat', () => {
  it('returns true for Duration', () => {
    expect(isTimeStat('Duration')).toBe(true);
  });
  it('returns true for Moving Time', () => {
    expect(isTimeStat('Moving Time')).toBe(true);
  });
  it('returns true for Average Duration', () => {
    expect(isTimeStat('Average Duration')).toBe(true);
  });
  it('returns true for movingtime (no space)', () => {
    expect(isTimeStat('movingtime')).toBe(true);
  });
  it('returns true for Duration with unit variant', () => {
    expect(isTimeStat('Duration in Seconds')).toBe(true);
  });
  it('returns false for Distance', () => {
    expect(isTimeStat('Distance')).toBe(false);
  });
});

describe('isDistanceStat', () => {
  it('returns true for Distance', () => {
    expect(isDistanceStat('Distance')).toBe(true);
  });
  it('returns true for Maximum Distance', () => {
    expect(isDistanceStat('Maximum Distance')).toBe(true);
  });
  it('returns false for Speed', () => {
    expect(isDistanceStat('Speed')).toBe(false);
  });
});

describe('isSpeedStat', () => {
  it('returns true for Speed', () => {
    expect(isSpeedStat('Speed')).toBe(true);
  });
  it('returns true for Average Speed in Knots', () => {
    expect(isSpeedStat('Average Speed in Knots')).toBe(true);
  });
  it('returns true for Vertical Speed', () => {
    expect(isSpeedStat('Vertical Speed')).toBe(true);
  });
  it('returns false for Heart Rate', () => {
    expect(isSpeedStat('Heart Rate')).toBe(false);
  });
});

describe('roundTo2Decimals', () => {
  it('returns integer as string without decimals', () => {
    expect(roundTo2Decimals(5)).toBe('5');
  });
  it('rounds to two decimal places', () => {
    expect(roundTo2Decimals(3.456)).toBe('3.46');
  });
  it('formats one decimal as two when needed', () => {
    expect(roundTo2Decimals(1.1)).toBe('1.10');
  });
  it('handles Infinity', () => {
    expect(roundTo2Decimals(Infinity)).toBe('Infinity');
  });
  it('handles NaN', () => {
    expect(roundTo2Decimals(Number.NaN)).toBe('NaN');
  });
  it('handles zero', () => {
    expect(roundTo2Decimals(0)).toBe('0');
  });
  it('handles negative with decimals', () => {
    expect(roundTo2Decimals(-2.555)).toBe('-2.56');
  });
});

describe('formatDistance', () => {
  it('formats sub-kilometer as meters', () => {
    expect(formatDistance(654)).toBe('654m');
  });
  it('formats exact kilometer', () => {
    expect(formatDistance(1000)).toBe('1km');
  });
  it('formats kilometer with decimals', () => {
    expect(formatDistance(1690)).toBe('1.69km');
  });
  it('formats large distance', () => {
    expect(formatDistance(42195)).toBe('42.20km');
  });
  it('formats zero', () => {
    expect(formatDistance(0)).toBe('0m');
  });
  it('returns string of input for negative', () => {
    expect(formatDistance(-100)).toBe('-100');
  });
  it('handles NaN', () => {
    expect(formatDistance(Number.NaN)).toBe('NaN');
  });
  it('rounds sub-meter decimal', () => {
    expect(formatDistance(0.7)).toBe('1m');
  });
  it('formats 2000 as 2km', () => {
    expect(formatDistance(2000)).toBe('2km');
  });
});

describe('formatDuration', () => {
  it('formats under a minute as MM:SS', () => {
    expect(formatDuration(45)).toBe('00:45');
  });
  it('formats exactly one minute', () => {
    expect(formatDuration(60)).toBe('01:00');
  });
  it('formats minutes and seconds', () => {
    expect(formatDuration(488)).toBe('08:08');
  });
  it('formats over an hour as H:MM:SS', () => {
    expect(formatDuration(3890)).toBe('1:04:50');
  });
  it('formats exactly one hour', () => {
    expect(formatDuration(3600)).toBe('1:00:00');
  });
  it('formats zero', () => {
    expect(formatDuration(0)).toBe('00:00');
  });
  it('returns string of input for negative', () => {
    expect(formatDuration(-10)).toBe('-10');
  });
  it('handles NaN', () => {
    expect(formatDuration(Number.NaN)).toBe('NaN');
  });
  it('floors fractional seconds', () => {
    expect(formatDuration(65.9)).toBe('01:05');
  });
  it('formats large value', () => {
    expect(formatDuration(7384)).toBe('2:03:04');
  });
});

describe('formatStatValue', () => {
  it('returns empty string for null', () => {
    expect(formatStatValue(null, 'Duration')).toBe('');
  });
  it('returns empty string for undefined', () => {
    expect(formatStatValue(undefined, 'Duration')).toBe('');
  });
  it('formats time stat with numeric value', () => {
    expect(formatStatValue(488, 'Duration')).toBe('08:08');
  });
  it('formats distance stat with numeric value', () => {
    expect(formatStatValue(1690, 'Distance')).toBe('1.69km');
  });
  it('formats speed stat without unit variant (m/s to km/h)', () => {
    expect(formatStatValue(10, 'Average Speed')).toBe('36');
  });
  it('formats speed stat with km/h unit variant', () => {
    expect(formatStatValue(25, 'Average Speed in Kilometers per Hour')).toBe('25');
  });
  it('formats speed stat with mph unit variant', () => {
    const result = formatStatValue(10, 'Average Speed in Miles per Hour');
    expect(parseFloat(result)).toBeCloseTo(16.09, 1);
  });
  it('formats speed stat with unknown unit variant (fallback m/s)', () => {
    expect(formatStatValue(10, 'Average Speed in Furlongs per Fortnight')).toBe('36');
  });
  it('coerces string to number for time stat', () => {
    expect(formatStatValue('488', 'Duration')).toBe('08:08');
  });
  it('formats array of numbers', () => {
    expect(formatStatValue([1.123, 2.456, 3])).toBe('1.12, 2.46, 3');
  });
  it('formats array with non-finite', () => {
    expect(formatStatValue([Number.NaN, 5])).toBe('NaN, 5');
  });
  it('formats coordinate object with latitude/longitude', () => {
    const result = formatStatValue({ latitude: 40.7128, longitude: -74.006 }, undefined);
    expect(result).toContain('°N');
    expect(result).toContain('°W');
  });
  it('formats coordinate object with latitudeDegrees/longitudeDegrees', () => {
    const result = formatStatValue(
      { latitudeDegrees: -33.8688, longitudeDegrees: 151.2093 },
      undefined
    );
    expect(result).toContain('°S');
    expect(result).toContain('°E');
  });
  it('formats plain number without statType', () => {
    expect(formatStatValue(3.14159)).toBe('3.14');
  });
  it('formats integer without statType', () => {
    expect(formatStatValue(42)).toBe('42');
  });
  it('returns empty string for null without statType', () => {
    expect(formatStatValue(null)).toBe('');
  });
  it('formats object that is not coordinate as JSON', () => {
    expect(formatStatValue({ foo: 'bar' })).toBe('{"foo":"bar"}');
  });
});
