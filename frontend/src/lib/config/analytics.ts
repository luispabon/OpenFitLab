/**
 * Google Analytics configuration
 *
 * Reads from Vite environment variables:
 * - VITE_GA_MEASUREMENT_ID: GA4 ID like G-XXXXXXXXXX (presence enables analytics)
 */

export interface AnalyticsConfig {
  measurementId: string | null;
  isValid: boolean;
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
  const measurementId = getStringEnv('VITE_GA_MEASUREMENT_ID', '', env);

  // Validate measurement ID format (GA4 IDs start with G-)
  const isValid = measurementId !== '' && /^G-[A-Z0-9]+$/i.test(measurementId);

  if (measurementId !== '' && !isValid) {
    console.warn(
      '[Analytics] VITE_GA_MEASUREMENT_ID is set but invalid. Expected format: G-XXXXXXXXXX'
    );
  }

  return {
    measurementId: measurementId || null,
    isValid,
  };
}

export const analyticsConfig: AnalyticsConfig = getAnalyticsConfig();
