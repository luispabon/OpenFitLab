import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAnalyticsConfig } from '../analytics.js';

describe('getAnalyticsConfig', () => {
  const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

  beforeEach(() => {
    consoleWarnSpy.mockClear();
  });

  it('should be disabled by default when env is empty', () => {
    const config = getAnalyticsConfig({});
    expect(config.isValid).toBe(false);
    expect(config.measurementId).toBe(null);
  });

  it('should be valid with a correct measurement ID', () => {
    const config = getAnalyticsConfig({ VITE_GA_MEASUREMENT_ID: 'G-ABC123DEF' });
    expect(config.isValid).toBe(true);
    expect(config.measurementId).toBe('G-ABC123DEF');
  });

  it('should accept lowercase measurement ID', () => {
    const config = getAnalyticsConfig({ VITE_GA_MEASUREMENT_ID: 'g-abc123def' });
    expect(config.isValid).toBe(true);
    expect(config.measurementId).toBe('g-abc123def');
  });

  it('should reject invalid measurement ID format', () => {
    const config = getAnalyticsConfig({ VITE_GA_MEASUREMENT_ID: 'invalid-id' });
    expect(config.isValid).toBe(false);
    expect(config.measurementId).toBe('invalid-id');
    expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('invalid'));
  });

  it('should be invalid when measurement ID is empty', () => {
    const config = getAnalyticsConfig({ VITE_GA_MEASUREMENT_ID: '' });
    expect(config.isValid).toBe(false);
    expect(config.measurementId).toBe(null);
    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });
});
