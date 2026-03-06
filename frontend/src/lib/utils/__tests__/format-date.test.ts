import { describe, it, expect } from 'vitest';
import {
  formatDate,
  formatDateShort,
  formatDateWithTime,
  formatDateWithOriginalTimezone,
} from '../format-date';

describe('formatDate', () => {
  it('returns empty date and time for null', () => {
    expect(formatDate(null)).toEqual({ date: '', time: '' });
  });
  it('returns empty date and time for undefined', () => {
    expect(formatDate(undefined)).toEqual({ date: '', time: '' });
  });
  it('returns non-empty date and time for timestamp', () => {
    const result = formatDate(1700000000000);
    expect(result.date.length).toBeGreaterThan(0);
    expect(result.time.length).toBeGreaterThan(0);
  });
  it('returns non-empty for Date object', () => {
    const result = formatDate(new Date(2024, 0, 15, 10, 30));
    expect(result.date.length).toBeGreaterThan(0);
    expect(result.time.length).toBeGreaterThan(0);
  });
});

describe('formatDateShort', () => {
  it('returns empty string for null', () => {
    expect(formatDateShort(null)).toBe('');
  });
  it('returns non-empty for number', () => {
    expect(formatDateShort(1700000000000).length).toBeGreaterThan(0);
  });
  it('returns toLocaleString for Date object (covers Date branch)', () => {
    const result = formatDateShort(new Date(2024, 0, 15));
    expect(result).not.toBe('');
    expect(result).toContain('2024');
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('formatDateWithTime', () => {
  it('returns empty string for null', () => {
    expect(formatDateWithTime(null)).toBe('');
  });
  it('includes "at" separator', () => {
    const result = formatDateWithTime(new Date(2024, 5, 15, 14, 30));
    expect(result).toContain(' at ');
  });
  it('includes date and time parts', () => {
    const result = formatDateWithTime(new Date(2024, 5, 15, 14, 30));
    expect(result.length).toBeGreaterThan(0);
    const [datePart, timePart] = result.split(' at ');
    expect(datePart.length).toBeGreaterThan(0);
    expect(timePart.length).toBeGreaterThan(0);
  });
  it('uses 24-hour format (no AM/PM)', () => {
    const result = formatDateWithTime(new Date(2024, 0, 1, 14, 30));
    expect(result).not.toMatch(/\s*(AM|PM)/i);
  });
});

describe('formatDateWithOriginalTimezone', () => {
  it('returns empty string for falsy ms', () => {
    expect(formatDateWithOriginalTimezone(0)).toBe('');
    expect(formatDateWithOriginalTimezone(null as unknown as number)).toBe('');
    expect(formatDateWithOriginalTimezone(undefined as unknown as number)).toBe('');
  });
  it('falls back to formatDateWithTime when no originalTimezone', () => {
    const ms = new Date(2024, 0, 15, 14, 30).getTime();
    const result = formatDateWithOriginalTimezone(ms);
    expect(result).toContain(' at ');
    expect(result).toBe(formatDateWithTime(ms));
  });
  it('returns string with " at " when originalTimezone provided', () => {
    const ms = new Date(Date.UTC(2024, 0, 15, 14, 30)).getTime();
    const result = formatDateWithOriginalTimezone(ms, 'UTC');
    expect(result).toContain(' at ');
    expect(result.length).toBeGreaterThan(0);
  });
  it('includes timezone in output when originalTimezone is UTC', () => {
    const ms = new Date(Date.UTC(2024, 0, 15, 14, 30)).getTime();
    const result = formatDateWithOriginalTimezone(ms, 'UTC');
    expect(result).toMatch(/UTC|GMT/i);
  });
  it('falls back to formatDateWithTime for invalid timezone', () => {
    const ms = new Date(2024, 0, 15, 14, 30).getTime();
    const result = formatDateWithOriginalTimezone(ms, 'Invalid/Timezone__');
    expect(result).toContain(' at ');
    expect(result.length).toBeGreaterThan(0);
  });
});
