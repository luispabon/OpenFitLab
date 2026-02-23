import { describe, it, expect } from 'vitest';
import {
  getStreamConfig,
  isChartableStream,
  isSmoothVariantToHide,
  getKnownStreamTypes,
  hasLocationStreams,
} from '../stream-config';

describe('getStreamConfig', () => {
  it('returns config for Heart Rate', () => {
    const config = getStreamConfig('Heart Rate');
    expect(config.color).toBe('#ef4444');
    expect(config.unit).toBe('bpm');
    expect(config.label).toBe('Heart Rate');
    expect(config.chartable).toBe(true);
  });
  it('returns config for Latitude with chartable false', () => {
    const config = getStreamConfig('Latitude');
    expect(config.chartable).toBe(false);
  });
  it('returns fallback for unknown type', () => {
    const config = getStreamConfig('Unknown Stream');
    expect(config.color).toBe('#38bdf8');
    expect(config.label).toBe('Unknown Stream');
    expect(config.chartable).toBe(true);
    expect(config.unit).toBe('');
  });
  it('trims whitespace and finds Speed', () => {
    const config = getStreamConfig('  Speed  ');
    expect(config.label).toBe('Speed');
  });
});

describe('isChartableStream', () => {
  it('returns true for Heart Rate', () => {
    expect(isChartableStream('Heart Rate')).toBe(true);
  });
  it('returns false for Time', () => {
    expect(isChartableStream('Time')).toBe(false);
  });
  it('returns false for Duration', () => {
    expect(isChartableStream('Duration')).toBe(false);
  });
  it('returns false for Position', () => {
    expect(isChartableStream('Position')).toBe(false);
  });
  it('returns true for unknown type (fallback)', () => {
    expect(isChartableStream('Mystery')).toBe(true);
  });
});

describe('isSmoothVariantToHide', () => {
  it('returns true when Smooth variant and base present', () => {
    expect(isSmoothVariantToHide('Altitude Smooth', ['Altitude', 'Altitude Smooth'])).toBe(true);
  });
  it('returns false when Smooth variant but base not in list', () => {
    expect(isSmoothVariantToHide('Altitude Smooth', ['Altitude Smooth'])).toBe(false);
  });
  it('returns false when not a Smooth variant', () => {
    expect(isSmoothVariantToHide('Altitude', ['Altitude', 'Altitude Smooth'])).toBe(false);
  });
  it('returns false for " Smooth" with empty base name', () => {
    expect(isSmoothVariantToHide(' Smooth', [' Smooth'])).toBe(false);
  });
});

describe('getKnownStreamTypes', () => {
  it('returns array including Heart Rate, Speed, Latitude, Position', () => {
    const types = getKnownStreamTypes();
    expect(types).toContain('Heart Rate');
    expect(types).toContain('Speed');
    expect(types).toContain('Latitude');
    expect(types).toContain('Position');
  });
  it('returns 14 configured types', () => {
    expect(getKnownStreamTypes()).toHaveLength(14);
  });
});

describe('hasLocationStreams', () => {
  it('returns true when Latitude and Longitude present', () => {
    expect(
      hasLocationStreams([
        { type: 'Latitude', data: [] },
        { type: 'Longitude', data: [] },
      ])
    ).toBe(true);
  });
  it('returns true when Position present', () => {
    expect(hasLocationStreams([{ type: 'Position', data: [] }])).toBe(true);
  });
  it('returns false when only Latitude', () => {
    expect(hasLocationStreams([{ type: 'Latitude', data: [] }])).toBe(false);
  });
  it('returns false when no location streams', () => {
    expect(hasLocationStreams([{ type: 'Heart Rate', data: [] }])).toBe(false);
  });
  it('returns false for empty array', () => {
    expect(hasLocationStreams([])).toBe(false);
  });
});
