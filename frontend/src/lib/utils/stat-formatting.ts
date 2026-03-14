import { parseStat } from './stat-parsing';

/** Whether this stat type is a duration/time metric (value in seconds). */
export function isTimeStat(statType: string): boolean {
  const metric = parseStat(statType).metric.toLowerCase();
  return (
    metric === 'duration' ||
    metric === 'time' ||
    metric === 'moving time' ||
    metric === 'movingtime'
  );
}

/** Whether this stat type is a distance metric (value in meters). */
export function isDistanceStat(statType: string): boolean {
  return parseStat(statType).metric.toLowerCase() === 'distance';
}

/** Whether this stat type is a speed metric. */
export function isSpeedStat(statType: string): boolean {
  return parseStat(statType).metric.toLowerCase().includes('speed');
}

/** Multipliers to convert speed value to km/h (value * factor = km/h). */
const SPEED_TO_KMH: Record<string, number> = {
  'kilometers per hour': 1,
  'km/h': 1,
  'meters per second': 3.6,
  'm/s': 3.6,
  'miles per hour': 1.60934,
  mph: 1.60934,
  'feet per minute': 0.018288,
  'feet per second': 1.09728,
  knots: 1.852,
  knot: 1.852, // API sometimes uses singular
  'meters per minute': 0.06,
};

function speedToKmh(value: number, unitVariant: string | null): number {
  if (value == null || !Number.isFinite(value)) return value;
  // sports-lib base "Average Speed" (no "in X") is in m/s
  if (!unitVariant) return value * 3.6;
  const key = unitVariant.toLowerCase();
  const factor = SPEED_TO_KMH[key];
  if (factor != null) return value * factor;
  return value * 3.6; // unknown variant, assume m/s
}

/** Rounds a number to 2 decimal places and returns a string (no trailing .00 for integers). */
export function roundTo2Decimals(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  const r = Math.round(n * 100) / 100;
  return Number.isInteger(r) ? String(r) : r.toFixed(2);
}

/**
 * Checks if a value is a coordinate-like object (latitude/longitude) and formats it for display.
 * Handles both { latitudeDegrees, longitudeDegrees } and { latitude, longitude }.
 * Returns null if not a coordinate object.
 */
function formatCoordinateValue(value: Record<string, unknown> | string): string | null {
  let lat: number | undefined;
  let lon: number | undefined;

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as Record<string, unknown>;
      lat = Number(parsed.latitudeDegrees ?? parsed.latitude);
      lon = Number(parsed.longitudeDegrees ?? parsed.longitude);
    } catch {
      return null;
    }
  } else if (value && typeof value === 'object') {
    lat = Number(
      (value as Record<string, unknown>).latitudeDegrees ??
        (value as Record<string, unknown>).latitude
    );
    lon = Number(
      (value as Record<string, unknown>).longitudeDegrees ??
        (value as Record<string, unknown>).longitude
    );
  } else {
    return null;
  }

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const latStr = Math.abs(lat).toFixed(6) + (lat >= 0 ? '°N' : '°S');
  const lonStr = Math.abs(lon).toFixed(6) + (lon >= 0 ? '°E' : '°W');
  return `${latStr}, ${lonStr}`;
}

/**
 * Formats distance in meters as human-friendly metric string.
 * Examples: 654 -> "654m", 1690 -> "1.69km", 1000 -> "1.00km".
 */
export function formatDistance(meters: number): string {
  const m = Number(meters);
  if (!Number.isFinite(m) || m < 0) return String(meters);
  if (m >= 1000) {
    const km = m / 1000;
    return km % 1 === 0 ? `${km}km` : `${km.toFixed(2)}km`;
  }
  return `${Math.round(m)}m`;
}

/**
 * Formats a duration in seconds as human-readable time.
 * Examples: 488 -> "08:08", 3890 -> "1:04:50", 65 -> "01:05".
 */
export function formatDuration(seconds: number): string {
  const s = Math.floor(Number(seconds));
  if (!Number.isFinite(s) || s < 0) return String(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  if (h > 0) return `${h}:${pad(m)}:${pad(sec)}`;
  return `${pad(m)}:${pad(sec)}`;
}

/**
 * Formats a stat value for display.
 * - Time stats: duration (e.g. "08:08", "1:04:50").
 * - Distance: human-friendly metric (e.g. "789m", "1.69km").
 * - Speed: always km/h (converts from other units if needed).
 */
export function formatStatValue(
  value: number | string | number[] | string[] | Record<string, unknown> | undefined | null,
  statType?: string
): string {
  if (value == null) return '';
  if (statType === 'PowerCurve') {
    return '';
  }
  if (statType) {
    const n = typeof value === 'string' ? Number(value) : value;
    if (typeof n === 'number' && Number.isFinite(n)) {
      if (isTimeStat(statType)) return formatDuration(n);
      if (isDistanceStat(statType)) return formatDistance(n);
      if (isSpeedStat(statType)) {
        const parsed = parseStat(statType);
        const kmh = speedToKmh(n, parsed.unitVariant);
        return typeof kmh === 'number' && Number.isFinite(kmh)
          ? roundTo2Decimals(kmh)
          : String(value);
      }
    }
  }
  if (Array.isArray(value)) {
    return value
      .map((v) => (typeof v === 'number' && Number.isFinite(v) ? roundTo2Decimals(v) : String(v)))
      .join(', ');
  }
  if (typeof value === 'object' && value !== null) {
    const coord = formatCoordinateValue(value as Record<string, unknown>);
    if (coord) return coord;
    return JSON.stringify(value);
  }
  if (typeof value === 'string') {
    const coord = formatCoordinateValue(value);
    if (coord) return coord;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return roundTo2Decimals(value);
  }
  return String(value);
}
