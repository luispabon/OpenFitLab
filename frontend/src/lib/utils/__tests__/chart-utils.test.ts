import { describe, it, expect, vi } from 'vitest';
import { Chart } from 'chart.js';

vi.mock('chart.js', async () => (await import('../../../test/chartjs-mock')).chartJsModuleMock());
vi.mock('chartjs-plugin-zoom', () => ({ default: { id: 'zoom' } }));

import zoomPlugin from 'chartjs-plugin-zoom';
import { chartJsRegistrables, chartRegistry } from '../../../test/chartjs-mock';
import {
  formatElapsedTime,
  formatWallClockTime,
  formatYValue,
  formatDurationCompact,
  toXYPoints,
  areaGradient,
  ZOOM_DRAG_OPTIONS,
  CHART_POWER_COLOR,
} from '../chart-utils';

type GradientContext = Parameters<ReturnType<typeof areaGradient>>[0];

describe('chart.js setup on module load', () => {
  it('registers controllers, elements, scales, tooltip, legend, and zoom plugin', () => {
    expect(chartRegistry.registered).toEqual([
      chartJsRegistrables.LineController,
      chartJsRegistrables.ScatterController,
      chartJsRegistrables.LineElement,
      chartJsRegistrables.PointElement,
      chartJsRegistrables.LinearScale,
      chartJsRegistrables.LogarithmicScale,
      chartJsRegistrables.Filler,
      chartJsRegistrables.Tooltip,
      chartJsRegistrables.Legend,
      zoomPlugin,
    ]);
  });

  it('sets the global tooltip caret padding to 24', () => {
    expect(Chart.defaults.plugins.tooltip.caretPadding).toBe(24);
  });
});

describe('toXYPoints', () => {
  const data: [number[], ...(number | null)[][]] = [
    [1, 2, 3],
    [10, null, 30],
    [5, 6, 7],
  ];

  it('maps shared x values and the selected series to {x, y} points', () => {
    expect(toXYPoints(data, 1)).toEqual([
      { x: 1, y: 10 },
      { x: 2, y: null },
      { x: 3, y: 30 },
    ]);
  });

  it('keeps null y values as { x, y: null } points', () => {
    expect(toXYPoints(data, 1)[1]).toEqual({ x: 2, y: null });
  });

  it('returns null y values when the series index does not exist', () => {
    expect(toXYPoints(data, 3)).toEqual([
      { x: 1, y: null },
      { x: 2, y: null },
      { x: 3, y: null },
    ]);
  });
});

describe('areaGradient', () => {
  it('fills from the top to the bottom of the chart area, fading to transparent', () => {
    const addColorStop = vi.fn();
    const createLinearGradient = vi.fn(() => ({ addColorStop }));
    const ctx = {
      chart: { chartArea: { top: 10, bottom: 110 }, ctx: { createLinearGradient } },
    } as unknown as GradientContext;

    const fill = areaGradient('#ff0000', '40')(ctx);

    expect(createLinearGradient).toHaveBeenCalledWith(0, 10, 0, 110);
    expect(addColorStop).toHaveBeenCalledWith(0, '#ff000040');
    expect(addColorStop).toHaveBeenCalledWith(1, '#ff000000');
    expect(fill).toEqual({ addColorStop });
  });

  it('falls back to a solid color before the chart area is laid out', () => {
    const createLinearGradient = vi.fn();
    const ctx = {
      chart: { chartArea: undefined, ctx: { createLinearGradient } },
    } as unknown as GradientContext;

    expect(areaGradient('#ff0000', '40')(ctx)).toBe('#ff000040');
    expect(createLinearGradient).not.toHaveBeenCalled();
  });
});

describe('ZOOM_DRAG_OPTIONS', () => {
  it('is the translucent blue drag-to-zoom rectangle', () => {
    expect(ZOOM_DRAG_OPTIONS).toEqual({
      enabled: true,
      backgroundColor: 'rgba(59, 130, 246, 0.25)',
      borderColor: 'rgb(59, 130, 246)',
      borderWidth: 1,
    });
  });
});

describe('formatElapsedTime', () => {
  it('formats zero as 0:00', () => {
    expect(formatElapsedTime(0)).toBe('0:00');
  });
  it('formats under a minute', () => {
    expect(formatElapsedTime(45000)).toBe('0:45');
  });
  it('formats exactly one minute', () => {
    expect(formatElapsedTime(60000)).toBe('1:00');
  });
  it('formats minutes and seconds', () => {
    expect(formatElapsedTime(125000)).toBe('2:05');
  });
  it('formats over an hour', () => {
    expect(formatElapsedTime(3661000)).toBe('1:01:01');
  });
  it('clamps negative to 0:00', () => {
    expect(formatElapsedTime(-5000)).toBe('0:00');
  });
  it('formats large value', () => {
    expect(formatElapsedTime(7384000)).toBe('2:03:04');
  });
});

describe('formatWallClockTime', () => {
  it('returns HH:MM format', () => {
    const result = formatWallClockTime(0);
    expect(result).toMatch(/^\d{1,2}:\d{2}$/);
  });
  it('returns non-empty for known timestamp', () => {
    const result = formatWallClockTime(1700000000000);
    expect(result.length).toBeGreaterThan(0);
    expect(result).toMatch(/^\d{1,2}:\d{2}$/);
  });
});

describe('formatYValue', () => {
  it('rounds Heart Rate to integer', () => {
    expect(formatYValue(142.7, 'Heart Rate')).toBe('143');
  });
  it('formats non-heart-rate with one decimal', () => {
    expect(formatYValue(25.678, 'Speed')).toBe('25.7');
  });
  it('formats zero for Power', () => {
    expect(formatYValue(0, 'Power')).toBe('0.0');
  });
  it('formats exact integer Heart Rate', () => {
    expect(formatYValue(120, 'Heart Rate')).toBe('120');
  });
});

describe('formatDurationCompact', () => {
  it('formats seconds with s suffix', () => {
    expect(formatDurationCompact(1)).toBe('1s');
    expect(formatDurationCompact(5)).toBe('5s');
    expect(formatDurationCompact(59)).toBe('59s');
  });
  it('formats minutes with m suffix', () => {
    expect(formatDurationCompact(60)).toBe('1m');
    expect(formatDurationCompact(300)).toBe('5m');
    expect(formatDurationCompact(3599)).toBe('60m');
  });
  it('formats hours with h suffix', () => {
    expect(formatDurationCompact(3600)).toBe('1.0h');
    expect(formatDurationCompact(7200)).toBe('2.0h');
  });
  it('clamps negative to 0s', () => {
    expect(formatDurationCompact(-10)).toBe('0s');
  });
});

describe('CHART_POWER_COLOR', () => {
  it('is a hex color string', () => {
    expect(CHART_POWER_COLOR).toMatch(/^#[0-9a-fA-F]{6}$/);
  });
});
