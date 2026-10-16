import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import OverlayChart from '../OverlayChart.svelte';
import { ZOOM_DRAG_OPTIONS } from '../../utils/chart-utils';
import { getStreamConfig } from '../../utils/stream-config';
import { emptyStreamsFixture, streamsWithNumericFixture } from '../../../test/fixtures/streams';
import {
  chartRegistry,
  getLastChartConfig,
  getLastChartInstance,
  resetChartMock,
} from '../../../test/chartjs-mock';

vi.mock('chart.js', async () => (await import('../../../test/chartjs-mock')).chartJsModuleMock());
vi.mock('chartjs-plugin-zoom', () => ({ default: { id: 'zoom' } }));

const heartRateStream = {
  type: 'Heart Rate',
  data: [
    { time: 1000, value: 80 },
    { time: 2000, value: 90 },
  ] as { time: number; value: number }[],
};

const cadenceStream = {
  type: 'Cadence',
  data: [{ time: 1000, value: 90 }] as { time: number; value: number }[],
};

describe('OverlayChart', () => {
  afterEach(() => {
    resetChartMock();
  });

  describe('empty / no-data', () => {
    it('renders "No data available" when streams is empty', () => {
      render(OverlayChart, {
        props: {
          streams: emptyStreamsFixture,
          activityStartDate: 1000,
        },
      });
      expect(screen.getByText(/No data available/)).toBeInTheDocument();
      expect(chartRegistry.configs).toHaveLength(0);
    });

    it('renders "No data available" when all streams have empty data', () => {
      render(OverlayChart, {
        props: {
          streams: [{ type: 'Heart Rate', data: [] }],
          activityStartDate: 1000,
        },
      });
      expect(screen.getByText(/No data available/)).toBeInTheDocument();
    });

    it('renders "No data available" when all streams have only non-numeric values', () => {
      render(OverlayChart, {
        props: {
          streams: [
            {
              type: 'Heart Rate',
              data: [
                { time: 1000, value: { n: 1 } },
                { time: 2000, value: { n: 2 } },
              ],
            },
          ],
          activityStartDate: 1000,
        },
      });
      expect(screen.getByText(/No data available/)).toBeInTheDocument();
    });

    it('does not render the chart container when there is no chart data', () => {
      render(OverlayChart, {
        props: {
          streams: emptyStreamsFixture,
          activityStartDate: 1000,
        },
      });
      expect(screen.queryByText('Reset Zoom')).not.toBeInTheDocument();
    });
  });

  describe('with data', () => {
    it('does not show "No data available" and renders chart container and Reset Zoom when at least one stream has valid numeric points', () => {
      render(OverlayChart, {
        props: {
          streams: streamsWithNumericFixture,
          activityStartDate: 1000,
        },
      });
      expect(screen.queryByText(/No data available/)).not.toBeInTheDocument();
      expect(screen.getByText('Reset Zoom')).toBeInTheDocument();
    });

    it('Reset Zoom button is present and initially hidden when not zoomed', () => {
      render(OverlayChart, {
        props: {
          streams: streamsWithNumericFixture,
          activityStartDate: 1000,
        },
      });
      const resetBtn = screen.getByText('Reset Zoom').closest('button');
      expect(resetBtn).toBeInTheDocument();
      expect(resetBtn).toHaveStyle({ display: 'none' });
    });
  });

  describe('chart configuration', () => {
    it('plots each stream on a shared elapsed x axis with null gaps for missing x values', () => {
      render(OverlayChart, {
        props: {
          streams: [heartRateStream, cadenceStream],
          activityStartDate: 1000,
        },
      });
      const config = getLastChartConfig();
      expect(config.type).toBe('line');
      expect(config.data.datasets.map((d) => d.label)).toEqual([
        getStreamConfig('Heart Rate').label,
        getStreamConfig('Cadence').label,
      ]);
      expect(config.data.datasets[0].data).toEqual([
        { x: 0, y: 80 },
        { x: 1000, y: 90 },
      ]);
      expect(config.data.datasets[1].data).toEqual([
        { x: 0, y: 90 },
        { x: 1000, y: null },
      ]);
      expect(config.options.scales.x.min).toBe(0);
      expect(config.options.scales.x.max).toBe(1000);
    });

    it('uses the index interaction mode for a shared tooltip', () => {
      render(OverlayChart, {
        props: {
          streams: [heartRateStream],
          activityStartDate: 1000,
        },
      });
      expect(getLastChartConfig().options.interaction).toEqual({
        mode: 'index',
        intersect: false,
      });
    });

    it('uses only the left y axis for a single stream', () => {
      render(OverlayChart, {
        props: {
          streams: [heartRateStream],
          activityStartDate: 1000,
        },
      });
      const config = getLastChartConfig();
      expect(config.data.datasets[0].yAxisID).toBe('y');
      expect(config.options.scales.y1).toBeUndefined();
    });

    it('puts the second stream on a right-hand y1 axis', () => {
      render(OverlayChart, {
        props: {
          streams: [heartRateStream, cadenceStream],
          activityStartDate: 1000,
        },
      });
      const config = getLastChartConfig();
      expect(config.data.datasets[0].yAxisID).toBe('y');
      expect(config.data.datasets[1].yAxisID).toBe('y1');
      expect(config.options.scales.y1.position).toBe('right');
    });

    it('enables drag zoom on the x axis only, with the shared drag style', () => {
      render(OverlayChart, {
        props: {
          streams: [heartRateStream],
          activityStartDate: 1000,
        },
      });
      const zoom = getLastChartConfig().options.plugins.zoom?.zoom;
      expect(zoom?.mode).toBe('x');
      expect(zoom?.drag).toEqual(ZOOM_DRAG_OPTIONS);
    });
  });

  describe('zoom and reset flow', () => {
    it('disables animation for zoom and reset transitions', () => {
      render(OverlayChart, {
        props: {
          streams: [heartRateStream],
          activityStartDate: 1000,
        },
      });
      expect(getLastChartConfig().options.transitions?.zoom?.animation?.duration).toBe(0);
    });

    it('shows Reset Zoom after a zoom completes and hides it after reset', async () => {
      render(OverlayChart, {
        props: {
          streams: [heartRateStream],
          activityStartDate: 1000,
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
      expect(instance.resetZoom).toHaveBeenCalledWith('none');
      expect(resetBtn).toHaveStyle({ display: 'none' });
    });
  });

  describe('effect and chart lifecycle', () => {
    it('destroys previous chart when streams change', async () => {
      const { rerender } = render(OverlayChart, {
        props: {
          streams: [heartRateStream],
          activityStartDate: 1000,
        },
      });
      await tick();
      const first = getLastChartInstance();
      rerender({
        streams: [heartRateStream, cadenceStream],
        activityStartDate: 1000,
      });
      await tick();
      expect(first.destroy).toHaveBeenCalled();
      expect(getLastChartConfig().data.datasets).toHaveLength(2);
    });

    it('destroys the chart on unmount', async () => {
      const { unmount } = render(OverlayChart, {
        props: {
          streams: streamsWithNumericFixture,
          activityStartDate: 1000,
        },
      });
      await tick();
      const instance = getLastChartInstance();
      unmount();
      expect(instance.destroy).toHaveBeenCalled();
    });
  });

  describe('viewport decimation', () => {
    const powerStream = {
      type: 'Power',
      data: [
        { time: 1000, value: 150 },
        { time: 2000, value: 300 },
      ] as { time: number; value: number }[],
    };

    it('uses one local aligned decimation plugin and no built-in Decimation', () => {
      render(OverlayChart, {
        props: {
          streams: [heartRateStream, cadenceStream],
          activityStartDate: 1000,
        },
      });
      const config = getLastChartConfig();
      expect(config.plugins?.map((plugin) => plugin.id)).toEqual(['alignedViewportDecimation']);
      expect(config.options.plugins).not.toHaveProperty('decimation');
    });

    it('suggests the full y range of each axis instead of a fixed min or max', () => {
      render(OverlayChart, {
        props: {
          streams: [heartRateStream, cadenceStream],
          activityStartDate: 1000,
        },
      });
      const { y, y1 } = getLastChartConfig().options.scales;
      expect(y.suggestedMin).toBe(80);
      expect(y.suggestedMax).toBe(90);
      expect(y1.suggestedMin).toBe(90);
      expect(y1.suggestedMax).toBe(90);
      expect(y.min).toBeUndefined();
      expect(y.max).toBeUndefined();
    });

    it('combines every series on the same axis into one suggested range', () => {
      render(OverlayChart, {
        props: {
          streams: [heartRateStream, cadenceStream, powerStream],
          activityStartDate: 1000,
        },
      });
      // Left axis: heart rate (80..90) and power (150..300). Right axis: cadence (90).
      const { y, y1 } = getLastChartConfig().options.scales;
      expect(y.suggestedMin).toBe(80);
      expect(y.suggestedMax).toBe(300);
      expect(y1.suggestedMin).toBe(90);
      expect(y1.suggestedMax).toBe(90);
    });

    it('keeps interleaved series unchanged through the local plugin when zoomed', () => {
      // Heart Rate has points at even seconds and Cadence at odd ones, so each series has a null
      // between every pair of its points. Strict run preservation keeps every point.
      const interleaved = (type: string, parity: number, base: number) => ({
        type,
        data: Array.from({ length: 300 }, (_, k) => ({
          time: 1000 + (2 * k + parity) * 1000,
          value: base + (k % 10),
        })),
      });
      render(OverlayChart, {
        props: {
          streams: [interleaved('Heart Rate', 0, 80), interleaved('Cadence', 1, 90)],
          activityStartDate: 1000,
        },
      });
      const config = getLastChartConfig();
      expect(config.plugins?.map((plugin) => plugin.id)).toEqual(['alignedViewportDecimation']);

      // Zoomed x range with a narrow canvas: 600 points exceed 4 * 50 buckets, yet nothing drops.
      const plugin = config.plugins?.[0] as unknown as {
        beforeUpdate: (chart: object, args: object, options: object) => void;
      };
      const chart = {
        options: { scales: { x: { min: 0, max: 599000 } } },
        width: 100,
        data: { datasets: config.data.datasets.map(() => ({ data: [] as unknown[] })) },
      };
      plugin.beforeUpdate(chart, {}, {});

      config.data.datasets.forEach((dataset, i) => {
        const reduced = chart.data.datasets[i].data;
        expect(reduced).toEqual(dataset.data);
        expect(reduced.filter((p) => (p as { y: number | null }).y === null)).toHaveLength(300);
      });
    });
  });
});
