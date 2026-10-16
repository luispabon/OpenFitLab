import {
  Chart,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  LogarithmicScale,
  PointElement,
  ScatterController,
  Tooltip,
  type ScriptableContext,
} from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';

Chart.register(
  LineController,
  ScatterController,
  LineElement,
  PointElement,
  LinearScale,
  LogarithmicScale,
  Filler,
  Tooltip,
  Legend,
  zoomPlugin
);

Chart.defaults.plugins.tooltip.caretPadding = 24;

/** Text color for axes, ticks, and labels (matches dark theme). */
export const CHART_TEXT_COLOR = '#a0a0a8';

/** Grid line color for chart axes. */
export const CHART_GRID_COLOR = '#2e2e33';

/** Default color for power curves (matches Power stream in stream-config). */
export const CHART_POWER_COLOR = '#a855f7';

/** Drag-to-zoom selection rectangle: translucent blue fill with a 1px blue border. */
export const ZOOM_DRAG_OPTIONS = {
  enabled: true,
  backgroundColor: 'rgba(59, 130, 246, 0.25)',
  borderColor: 'rgb(59, 130, 246)',
  borderWidth: 1,
};

/** Zoom updates should not animate long-series layout on every frame. */
export const ZOOM_TRANSITION_OPTIONS = {
  transitions: { zoom: { animation: { duration: 0 } } },
};

/** Shared x values (index 0) followed by one y array per series. null y values leave gaps. */
export type AlignedSeriesData = [number[], ...(number | null)[][]];

/**
 * Chart.js {x, y} points for one series of aligned data. A missing y stays as { x, y: null }
 * (never a bare null, which Chart.js does not handle in object-form datasets).
 */
export function toXYPoints(
  data: AlignedSeriesData,
  seriesIndex: number
): { x: number; y: number | null }[] {
  const ys = data[seriesIndex] ?? [];
  return data[0].map((x, i) => ({ x, y: ys[i] ?? null }));
}

/** Vertical gradient fill: `color` + `alpha` at the top of the plot area, fading to transparent. */
export function areaGradient(color: string, alpha: string) {
  return (ctx: ScriptableContext<'line'>) => {
    const { chart } = ctx;
    if (!chart.chartArea) return color + alpha;
    const { top, bottom } = chart.chartArea;
    const grd = chart.ctx.createLinearGradient(0, top, 0, bottom);
    grd.addColorStop(0, color + alpha);
    grd.addColorStop(1, color + '00');
    return grd;
  };
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
