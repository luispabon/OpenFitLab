import { describe, it, expect } from 'vitest';
import { getPrivacyConfig } from '../privacy.js';

describe('getPrivacyConfig', () => {
  it('uses defaults when env is empty', () => {
    const cfg = getPrivacyConfig({});
    expect(cfg.email).toBeNull();
    expect(cfg.region).toBe('United Kingdom');
    expect(typeof cfg.lastUpdated).toBe('string');
    expect(cfg.lastUpdated.length).toBeGreaterThan(0);
  });

  it('reads email, region, and lastUpdated from env', () => {
    const cfg = getPrivacyConfig({
      VITE_PRIVACY_EMAIL: 'privacy@example.com',
      VITE_PRIVACY_REGION: 'Germany',
      VITE_PRIVACY_LAST_UPDATED: '2026-03-04',
    });
    expect(cfg.email).toBe('privacy@example.com');
    expect(cfg.region).toBe('Germany');
    expect(cfg.lastUpdated).toBe('2026-03-04');
  });

  it('derives hasAnalytics from analyticsConfig.isValid (via env)', () => {
    const cfgDisabled = getPrivacyConfig({
      VITE_GA_ENABLED: 'false',
      VITE_GA_MEASUREMENT_ID: 'G-TEST',
    });
    expect(cfgDisabled.hasAnalytics).toBe(false);
    expect(cfgDisabled.analyticsConfig).toBeNull();

    const cfgEnabled = getPrivacyConfig({
      VITE_GA_ENABLED: 'true',
      VITE_GA_MEASUREMENT_ID: 'G-TEST123',
    });
    expect(cfgEnabled.hasAnalytics).toBe(true);
    expect(cfgEnabled.analyticsConfig).not.toBeNull();
    if (cfgEnabled.analyticsConfig) {
      expect(cfgEnabled.analyticsConfig.anonymizeIp).toBe(true);
      expect(cfgEnabled.analyticsConfig.dataRetention).toBe('14 months');
      expect(cfgEnabled.analyticsConfig.advertisingFeatures).toBe(false);
    }
  });
});
