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
  getSmoothPath,
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

describe('getSmoothPath', () => {
  it('returns linear path builder when spline is missing (fallback)', () => {
    const pathBuilder = getSmoothPath();
    expect(typeof pathBuilder).toBe('function');
  });
});
