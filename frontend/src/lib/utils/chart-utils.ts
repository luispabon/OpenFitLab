import uPlot from 'uplot'

/** Height used for all time-series charts (single source of truth). */
export const CHART_HEIGHT = 384

/** Text color for axes, ticks, and labels (matches dark theme). */
export const CHART_TEXT_COLOR = '#d1d5db'

/** Grid line color for chart axes. */
export const CHART_GRID_COLOR = 'rgba(255,255,255,0.12)'

/**
 * Format milliseconds since epoch or elapsed ms as H:MM:SS or M:SS.
 * Input is treated as elapsed time (e.g. relative to activity start).
 */
export function formatElapsedTime(ms: number): string {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

/**
 * Format timestamp (ms since epoch) as HH:MM for wall-clock display.
 */
export function formatWallClockTime(ms: number): string {
  const date = new Date(ms)
  const hours = date.getHours()
  const minutes = date.getMinutes()
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
}

/**
 * Format a Y-axis value for tooltip/legend. Heart Rate is shown as integer; others as 1 decimal.
 */
export function formatYValue(value: number, seriesLabel: string): string {
  if (seriesLabel === 'Heart Rate') return Math.round(value).toString()
  return value.toFixed(1)
}

/**
 * uPlot path renderer: spline when available, else linear.
 * Shared by TimeSeriesChart, OverlayChart, and ComparisonChart.
 */
export function getSmoothPath(): uPlot.Series.PathBuilder {
  return (uPlot.paths.spline?.() ?? uPlot.paths.linear?.())!
}
