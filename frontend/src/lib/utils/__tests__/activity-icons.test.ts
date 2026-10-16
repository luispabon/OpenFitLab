import { describe, it, expect } from 'vitest';
import { getActivityIcon, getActivityIconColor } from '../activity-icons';

describe('getActivityIcon', () => {
  it('returns directions_run for running', () => {
    expect(getActivityIcon('running')).toBe('directions_run');
  });
  it('returns directions_bike for cycling', () => {
    expect(getActivityIcon('cycling')).toBe('directions_bike');
  });
  it('returns pool for swimming', () => {
    expect(getActivityIcon('swimming')).toBe('pool');
  });
  it('returns self_improvement for yoga', () => {
    expect(getActivityIcon('yoga')).toBe('self_improvement');
  });
  it('is case-insensitive', () => {
    expect(getActivityIcon('Running')).toBe('directions_run');
  });
  it('uses substring fallback for Trail Run', () => {
    expect(getActivityIcon('Trail Run')).toBe('directions_run');
  });
  it('uses substring fallback for Indoor Cycling', () => {
    expect(getActivityIcon('Indoor Cycling')).toBe('directions_bike');
  });
  it('returns category for unknown activity type', () => {
    expect(getActivityIcon('Underwater Basket Weaving')).toBe('category');
  });
  it('returns category when no exact match and no substring fallback (line 187)', () => {
    expect(getActivityIcon('unknown-activity-xyz')).toBe('category');
  });
  it('returns category for null', () => {
    expect(getActivityIcon(null)).toBe('category');
  });
  it('returns category for undefined', () => {
    expect(getActivityIcon(undefined)).toBe('category');
  });
  it('returns category for empty string', () => {
    expect(getActivityIcon('')).toBe('category');
  });
  it('uses first segment for comma-separated', () => {
    expect(getActivityIcon('running, swimming')).toBe('directions_run');
  });
  it('exact match takes priority (skating -> ice_skating)', () => {
    expect(getActivityIcon('skating')).toBe('ice_skating');
  });
});

describe('getActivityIconColor', () => {
  it('colours foot-based and cardio-machine activities green', () => {
    expect(getActivityIconColor('running')).toBe('text-data-green');
    expect(getActivityIconColor('Elliptical Trainer')).toBe('text-data-green');
  });
  it('colours cycling blue', () => {
    expect(getActivityIconColor('Indoor Cycling')).toBe('text-data-blue');
  });
  it('colours strength training orange', () => {
    expect(getActivityIconColor('Strength Training')).toBe('text-data-orange');
  });
  it('colours yoga violet', () => {
    expect(getActivityIconColor('yoga')).toBe('text-data-violet');
  });
  it('colours water activities teal', () => {
    expect(getActivityIconColor('swimming')).toBe('text-data-teal');
  });
  it('colours ball sports amber', () => {
    expect(getActivityIconColor('tennis')).toBe('text-data-amber');
  });
  it('uses the first activity of a comma-separated list', () => {
    expect(getActivityIconColor('cycling, running')).toBe('text-data-blue');
  });
  it('falls back to a neutral colour for unknown, empty or missing types', () => {
    expect(getActivityIconColor('Underwater Basket Weaving')).toBe('text-text-secondary');
    expect(getActivityIconColor('Other')).toBe('text-text-secondary');
    expect(getActivityIconColor('')).toBe('text-text-secondary');
    expect(getActivityIconColor(null)).toBe('text-text-secondary');
    expect(getActivityIconColor(undefined)).toBe('text-text-secondary');
  });
});
