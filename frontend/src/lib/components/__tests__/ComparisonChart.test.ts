import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import ComparisonChart from '../ComparisonChart.svelte';
import type { ComparisonChartEntry } from '../../utils/comparison-chart-data';
import { ZOOM_DRAG_OPTIONS } from '../../utils/chart-utils';
import { getStreamConfig } from '../../utils/stream-config';
import {
  chartRegistry,
  getLastChartConfig,
  getLastChartInstance,
  resetChartMock,
} from '../../../test/chartjs-mock';

vi.mock('chart.js', async () => (await import('../../../test/chartjs-mock')).chartJsModuleMock());
vi.mock('chartjs-plugin-zoom', () => ({ default: { id: 'zoom' } }));

function entry(
  activityStartDate: number,
  data: { time: number; value: number }[],
  overrides?: Partial<ComparisonChartEntry>
): ComparisonChartEntry {
  return {
    eventName: 'Device',
    color: '#000',
    data: { type: 'Heart Rate', data },
    activityStartDate,
    ...overrides,
  };
}

describe('ComparisonChart', () => {
  afterEach(() => {
    resetChartMock();
  });

  describe('empty / no-data rendering', () => {
    it('shows "No data available" when entries is empty', () => {
      render(ComparisonChart, {
        props: {
          streamType: 'Heart Rate',
          entries: [],
          xAxisMode: 'elapsed',
        },
      });
      expect(screen.getByText(/No data available/)).toBeInTheDocument();
      expect(chartRegistry.configs).toHaveLength(0);
    });

    it('shows "No data available" when single entry has empty stream data', () => {
      render(ComparisonChart, {
        props: {
          streamType: 'Heart Rate',
          entries: [entry(1000, [])],
          xAxisMode: 'elapsed',
        },
      });
      expect(screen.getByText(/No data available/)).toBeInTheDocument();
    });
  });

  describe('chart rendered when data exists', () => {
    it('renders chart container and does not show "No data available"', () => {
      render(ComparisonChart, {
        props: {
          streamType: 'Heart Rate',
          entries: [entry(1000, [{ time: 1000, value: 80 }])],
          xAxisMode: 'elapsed',
        },
      });
      expect(screen.queryByText(/No data available/)).not.toBeInTheDocument();
      expect(screen.getByText('Reset Zoom')).toBeInTheDocument();
    });
  });

  describe('reset zoom button', () => {
    it('Reset Zoom button exists and is initially hidden when not zoomed', () => {
      render(ComparisonChart, {
        props: {
          streamType: 'Heart Rate',
          entries: [entry(1000, [{ time: 1000, value: 80 }])],
          xAxisMode: 'elapsed',
        },
      });
      const resetBtn = screen.getByText('Reset Zoom').closest('button');
      expect(resetBtn).toBeInTheDocument();
      expect(resetBtn).toHaveStyle({ display: 'none' });
    });
  });

  describe('chart configuration', () => {
    const twoEntries = [
      entry(
        1000,
        [
          { time: 1000, value: 80 },
          { time: 2000, value: 90 },
        ],
        { eventName: 'Device A', color: '#ef4444' }
      ),
      entry(2000, [{ time: 2000, value: 100 }], { eventName: 'Device B', color: '#3b82f6' }),
    ];

    it('creates one line dataset per entry, colored by entry', () => {
      render(ComparisonChart, {
        props: { streamType: 'Heart Rate', entries: twoEntries, xAxisMode: 'elapsed' },
      });
      const config = getLastChartConfig();
      expect(config.type).toBe('line');
      expect(config.data.datasets.map((d) => d.label)).toEqual(['Device A', 'Device B']);
      expect(config.data.datasets.map((d) => d.borderColor)).toEqual(['#ef4444', '#3b82f6']);
    });

    it('aligns elapsed x values to the earliest activity start', () => {
      render(ComparisonChart, {
        props: { streamType: 'Heart Rate', entries: twoEntries, xAxisMode: 'elapsed' },
      });
      const config = getLastChartConfig();
      expect(config.data.datasets[0].data).toEqual([
        { x: 0, y: 80 },
        { x: 1000, y: 90 },
      ]);
      expect(config.data.datasets[1].data).toEqual([
        { x: 0, y: 100 },
        { x: 1000, y: 100 },
      ]);
      expect(config.options.scales.x.min).toBe(0);
      expect(config.options.scales.x.max).toBe(1000);
      expect(config.options.scales.x.title?.text).toBe('Elapsed Time');
    });

    it('uses absolute times and a Time axis title in wall-clock mode', () => {
      render(ComparisonChart, {
        props: { streamType: 'Heart Rate', entries: twoEntries, xAxisMode: 'wall-clock' },
      });
      const config = getLastChartConfig();
      expect(config.options.scales.x.min).toBe(1000);
      expect(config.options.scales.x.max).toBe(2000);
      expect(config.options.scales.x.title?.text).toBe('Time');
    });

    it('titles the y axis with the stream label and unit', () => {
      render(ComparisonChart, {
        props: { streamType: 'Heart Rate', entries: twoEntries, xAxisMode: 'elapsed' },
      });
      const { label, unit } = getStreamConfig('Heart Rate');
      expect(getLastChartConfig().options.scales.y.title?.text).toBe(
        unit ? `${label} (${unit})` : label
      );
    });

    it('enables drag zoom on the x axis only, with the shared drag style', () => {
      render(ComparisonChart, {
        props: { streamType: 'Heart Rate', entries: twoEntries, xAxisMode: 'elapsed' },
      });
      const zoom = getLastChartConfig().options.plugins.zoom?.zoom;
      expect(zoom?.mode).toBe('x');
      expect(zoom?.drag).toEqual(ZOOM_DRAG_OPTIONS);
    });
  });

  describe('zoom and reset flow', () => {
    it('shows Reset Zoom after a zoom completes and hides it after reset', async () => {
      render(ComparisonChart, {
        props: {
          streamType: 'Heart Rate',
          entries: [entry(1000, [{ time: 1000, value: 80 }])],
          xAxisMode: 'elapsed',
        },
      });
      await tick();
      const instance = getLastChartInstance();
      const resetBtn = screen.getByText('Reset Zoom').closest('button')!;

      instance.isZoomedOrPanned.mockReturnValue(true);
      getLastChartConfig().options.plugins.zoom?.zoom.onZoomComplete?.({ chart: instance });
      await tick();
      expect(resetBtn).toHaveStyle({ display: 'block' });

      resetBtn.click();
      await tick();
      expect(instance.resetZoom).toHaveBeenCalledTimes(1);
      expect(resetBtn).toHaveStyle({ display: 'none' });
    });
  });

  describe('effect and chart lifecycle', () => {
    it('destroys previous chart when entries change', async () => {
      const { rerender } = render(ComparisonChart, {
        props: {
          streamType: 'Heart Rate',
          entries: [entry(1000, [{ time: 1000, value: 80 }])],
          xAxisMode: 'elapsed',
        },
      });
      await tick();
      const first = getLastChartInstance();
      rerender({
        streamType: 'Heart Rate',
        entries: [
          entry(1000, [{ time: 1000, value: 80 }]),
          entry(2000, [{ time: 2000, value: 90 }]),
        ],
        xAxisMode: 'elapsed',
      });
      await tick();
      expect(first.destroy).toHaveBeenCalled();
      expect(getLastChartConfig().data.datasets).toHaveLength(2);
    });

    it('destroys the chart on unmount', async () => {
      const { unmount } = render(ComparisonChart, {
        props: {
          streamType: 'Heart Rate',
          entries: [entry(1000, [{ time: 1000, value: 80 }])],
          xAxisMode: 'elapsed',
        },
      });
      await tick();
      const instance = getLastChartInstance();
      unmount();
      expect(instance.destroy).toHaveBeenCalled();
    });
  });
});
