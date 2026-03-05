/**
 * Google Analytics configuration
 *
 * Reads from Vite environment variables:
 * - VITE_GA_ENABLED: Master toggle (default: false)
 * - VITE_GA_MEASUREMENT_ID: GA4 ID like G-XXXXXXXXXX
 */

export interface AnalyticsConfig {
  enabled: boolean;
  measurementId: string | null;
  isValid: boolean;
}

function getBooleanEnv(key: string, defaultValue: boolean, env: Record<string, unknown>): boolean {
  const value = env[key];
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  return String(value).toLowerCase() === 'true';
}

function getStringEnv(key: string, defaultValue: string, env: Record<string, unknown>): string {
  const value = env[key];
  return value !== undefined && value !== null ? String(value) : defaultValue;
}

/**
 * Build analytics config from an env object.
 * Used at runtime with import.meta.env; pass a mock env in tests.
 */
export function getAnalyticsConfig(
  env: Record<string, unknown> = import.meta.env as Record<string, unknown>
): AnalyticsConfig {
  const enabled = getBooleanEnv('VITE_GA_ENABLED', false, env);
  const measurementId = getStringEnv('VITE_GA_MEASUREMENT_ID', '', env);

  // Validate measurement ID format (GA4 IDs start with G-)
  const isValid = enabled && measurementId !== '' && /^G-[A-Z0-9]+$/i.test(measurementId);

  if (enabled && !isValid) {
    console.warn(
      '[Analytics] VITE_GA_ENABLED is true but VITE_GA_MEASUREMENT_ID ' +
        'is missing or invalid. Expected format: G-XXXXXXXXXX'
    );
  }

  return {
    enabled,
    measurementId: measurementId || null,
    isValid,
  };
}

export const analyticsConfig: AnalyticsConfig = getAnalyticsConfig();
