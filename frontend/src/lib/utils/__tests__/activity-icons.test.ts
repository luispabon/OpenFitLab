import { describe, it, expect } from 'vitest';
import { getActivityIcon } from '../activity-icons';

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
