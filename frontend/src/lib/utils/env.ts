/**
 * Read a numeric value from a Vite env var (import.meta.env).
 * Use for optional build-time config with default and optional min/max clamp.
 * @param envSource - Optional override for testing; defaults to import.meta.env.
 */
export function getEnvNumber(
  key: string,
  options: { default: number; min?: number; max?: number },
  envSource?: Record<string, unknown>
): number {
  const env = envSource ?? (import.meta.env as Record<string, unknown>);
  const raw = env[key];
  const str = raw != null && raw !== '' ? String(raw) : null;
  const n = str != null ? parseInt(str, 10) : options.default;
  const value = Number.isNaN(n) ? options.default : n;
  const min = options.min;
  const max = options.max;
  if (min != null && value < min) return min;
  if (max != null && value > max) return max;
  return value;
}
