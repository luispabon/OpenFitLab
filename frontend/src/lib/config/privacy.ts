import type { PrivacyInfo } from '../types';
import { analyticsConfig } from './analytics.js';

function getStringEnv(key: string, defaultValue: string, env: Record<string, unknown>): string {
  const value = env[key];
  return value !== undefined && value !== null ? String(value) : defaultValue;
}

export function getPrivacyConfig(
  env: Record<string, unknown> = import.meta.env as Record<string, unknown>
): PrivacyInfo {
  const emailRaw = getStringEnv('VITE_PRIVACY_EMAIL', '', env).trim();
  const region =
    getStringEnv('VITE_PRIVACY_REGION', 'United Kingdom', env).trim() || 'United Kingdom';
  const lastUpdated = getStringEnv('VITE_PRIVACY_LAST_UPDATED', '', env).trim() || '2026-03-04';

  const hasAnalytics = analyticsConfig.isValid;

  return {
    email: emailRaw === '' ? null : emailRaw,
    region,
    lastUpdated,
    hasAnalytics,
    analyticsConfig: hasAnalytics
      ? {
          anonymizeIp: true,
          dataRetention: '14 months',
          advertisingFeatures: false,
        }
      : null,
  };
}

export const privacyConfig: PrivacyInfo = getPrivacyConfig();
