import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getAnalyticsConfig } from '../analytics.js';

describe('getAnalyticsConfig', () => {
  const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

  beforeEach(() => {
    consoleWarnSpy.mockClear();
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  it('should be disabled by default when env is empty', () => {
    const config = getAnalyticsConfig({});
    expect(config.enabled).toBe(false);
    expect(config.isValid).toBe(false);
    expect(config.measurementId).toBe(null);
  });

  it('should be disabled when VITE_GA_ENABLED is false', () => {
    const config = getAnalyticsConfig({
      VITE_GA_ENABLED: 'false',
      VITE_GA_MEASUREMENT_ID: 'G-ABC123DEF',
    });
    expect(config.enabled).toBe(false);
    expect(config.isValid).toBe(false);
  });

  it('should validate measurement ID format (valid G- id)', () => {
    const config = getAnalyticsConfig({
      VITE_GA_ENABLED: 'true',
      VITE_GA_MEASUREMENT_ID: 'G-ABC123DEF',
    });
    expect(config.enabled).toBe(true);
    expect(config.isValid).toBe(true);
    expect(config.measurementId).toBe('G-ABC123DEF');
  });

  it('should accept lowercase measurement ID', () => {
    const config = getAnalyticsConfig({
      VITE_GA_ENABLED: 'true',
      VITE_GA_MEASUREMENT_ID: 'g-abc123def',
    });
    expect(config.isValid).toBe(true);
    expect(config.measurementId).toBe('g-abc123def');
  });

  it('should reject invalid measurement ID format', () => {
    const config = getAnalyticsConfig({
      VITE_GA_ENABLED: 'true',
      VITE_GA_MEASUREMENT_ID: 'invalid-id',
    });
    expect(config.enabled).toBe(true);
    expect(config.isValid).toBe(false);
    expect(config.measurementId).toBe('invalid-id');
    expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('missing or invalid'));
  });

  it('should set isValid false when enabled but measurement ID is empty', () => {
    const config = getAnalyticsConfig({
      VITE_GA_ENABLED: 'true',
      VITE_GA_MEASUREMENT_ID: '',
    });
    expect(config.enabled).toBe(true);
    expect(config.isValid).toBe(false);
    expect(config.measurementId).toBe(null);
    expect(consoleWarnSpy).toHaveBeenCalled();
  });

  it('should treat VITE_GA_ENABLED "true" as true', () => {
    const config = getAnalyticsConfig({
      VITE_GA_ENABLED: 'true',
      VITE_GA_MEASUREMENT_ID: 'G-X',
    });
    expect(config.enabled).toBe(true);
  });
});
