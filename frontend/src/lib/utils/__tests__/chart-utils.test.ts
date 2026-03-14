import { describe, it, expect, vi } from 'vitest';

vi.mock('uplot', () => ({
  default: {
    paths: {
      spline: undefined,
      linear: () => () => {},
    },
  },
}));

import {
  formatElapsedTime,
  formatWallClockTime,
  formatYValue,
  formatDurationCompact,
  CHART_POWER_COLOR,
  getPowerCurveSplits,
  getSmoothPath,
  POWER_CURVE_SPLITS,
} from '../chart-utils';

describe('formatElapsedTime', () => {
  it('formats zero as 0:00', () => {
    expect(formatElapsedTime(0)).toBe('0:00');
  });
  it('formats under a minute', () => {
    expect(formatElapsedTime(45000)).toBe('0:45');
  });
  it('formats exactly one minute', () => {
    expect(formatElapsedTime(60000)).toBe('1:00');
  });
  it('formats minutes and seconds', () => {
    expect(formatElapsedTime(125000)).toBe('2:05');
  });
  it('formats over an hour', () => {
    expect(formatElapsedTime(3661000)).toBe('1:01:01');
  });
  it('clamps negative to 0:00', () => {
    expect(formatElapsedTime(-5000)).toBe('0:00');
  });
  it('formats large value', () => {
    expect(formatElapsedTime(7384000)).toBe('2:03:04');
  });
});

describe('formatWallClockTime', () => {
  it('returns HH:MM format', () => {
    const result = formatWallClockTime(0);
    expect(result).toMatch(/^\d{1,2}:\d{2}$/);
  });
  it('returns non-empty for known timestamp', () => {
    const result = formatWallClockTime(1700000000000);
    expect(result.length).toBeGreaterThan(0);
    expect(result).toMatch(/^\d{1,2}:\d{2}$/);
  });
});

describe('formatYValue', () => {
  it('rounds Heart Rate to integer', () => {
    expect(formatYValue(142.7, 'Heart Rate')).toBe('143');
  });
  it('formats non-heart-rate with one decimal', () => {
    expect(formatYValue(25.678, 'Speed')).toBe('25.7');
  });
  it('formats zero for Power', () => {
    expect(formatYValue(0, 'Power')).toBe('0.0');
  });
  it('formats exact integer Heart Rate', () => {
    expect(formatYValue(120, 'Heart Rate')).toBe('120');
  });
});

describe('getPowerCurveSplits', () => {
  it('returns only breakpoints within the given range', () => {
    expect(getPowerCurveSplits(10, 120)).toEqual([10, 15, 20, 30, 60, 120]);
    expect(getPowerCurveSplits(1, 30)).toEqual([1, 2, 5, 10, 15, 20, 30]);
  });
  it('returns the full array when range covers all breakpoints', () => {
    expect(getPowerCurveSplits(1, 7200)).toEqual(POWER_CURVE_SPLITS);
    expect(getPowerCurveSplits(0, 10000)).toEqual(POWER_CURVE_SPLITS);
  });
  it('returns empty when range is outside all breakpoints', () => {
    expect(getPowerCurveSplits(0.5, 0.9)).toEqual([]);
    expect(getPowerCurveSplits(10000, 20000)).toEqual([]);
  });
});

describe('getSmoothPath', () => {
  it('returns linear path builder when spline is missing (fallback)', () => {
    const pathBuilder = getSmoothPath();
    expect(typeof pathBuilder).toBe('function');
  });
});

describe('formatDurationCompact', () => {
  it('formats seconds with s suffix', () => {
    expect(formatDurationCompact(1)).toBe('1s');
    expect(formatDurationCompact(5)).toBe('5s');
    expect(formatDurationCompact(59)).toBe('59s');
  });
  it('formats minutes with m suffix', () => {
    expect(formatDurationCompact(60)).toBe('1m');
    expect(formatDurationCompact(300)).toBe('5m');
    expect(formatDurationCompact(3599)).toBe('60m');
  });
  it('formats hours with h suffix', () => {
    expect(formatDurationCompact(3600)).toBe('1.0h');
    expect(formatDurationCompact(7200)).toBe('2.0h');
  });
  it('clamps negative to 0s', () => {
    expect(formatDurationCompact(-10)).toBe('0s');
  });
});

describe('CHART_POWER_COLOR', () => {
  it('is a hex color string', () => {
    expect(CHART_POWER_COLOR).toMatch(/^#[0-9a-fA-F]{6}$/);
  });
});
