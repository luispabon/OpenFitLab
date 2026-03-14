import uPlot from 'uplot';

/** Height used for all time-series charts (single source of truth). */
export const CHART_HEIGHT = 384;

/** Text color for axes, ticks, and labels (matches dark theme). */
export const CHART_TEXT_COLOR = '#d1d5db';

/** Grid line color for chart axes. */
export const CHART_GRID_COLOR = 'rgba(255,255,255,0.12)';

/** Default color for power curves (matches Power stream in stream-config). */
export const CHART_POWER_COLOR = '#a855f7';

/**
 * Human-meaningful duration breakpoints (seconds) for Power Curve x-axis gridlines.
 * Labels: 1s, 2s, 5s, 10s, 15s, 20s, 30s, 1m, 2m, 5m, 10m, 20m, 30m, 1h, 1.5h, 2h.
 */
export const POWER_CURVE_SPLITS = [
  1, 2, 5, 10, 15, 20, 30, 60, 120, 300, 600, 1200, 1800, 3600, 5400, 7200,
];

/**
 * Returns Power Curve x-axis splits (gridline positions) within the visible scale range.
 */
export function getPowerCurveSplits(scaleMin: number, scaleMax: number): number[] {
  return POWER_CURVE_SPLITS.filter((v) => v >= scaleMin && v <= scaleMax);
}

/**
 * Format duration in seconds for PowerCurve X-axis labels (e.g. "1s", "5m", "1h").
 * Used on logarithmic duration axis.
 */
export function formatDurationCompact(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  return `${(s / 3600).toFixed(1)}h`;
}

/**
 * Format milliseconds since epoch or elapsed ms as H:MM:SS or M:SS.
 * Input is treated as elapsed time (e.g. relative to activity start).
 */
export function formatElapsedTime(ms: number): string {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Format timestamp (ms since epoch) as HH:MM for wall-clock display.
 */
export function formatWallClockTime(ms: number): string {
  const date = new Date(ms);
  const hours = date.getHours();
  const minutes = date.getMinutes();
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

/**
 * Format a Y-axis value for tooltip/legend. Heart Rate is shown as integer; others as 1 decimal.
 */
export function formatYValue(value: number, seriesLabel: string): string {
  if (seriesLabel === 'Heart Rate') return Math.round(value).toString();
  return value.toFixed(1);
}

/**
 * uPlot path renderer: spline when available, else linear.
 * Shared by TimeSeriesChart, OverlayChart, and ComparisonChart.
 */
export function getSmoothPath(): uPlot.Series.PathBuilder {
  return (uPlot.paths.spline?.() ?? uPlot.paths.linear?.())!;
}
