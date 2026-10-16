import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import TimeSeriesChart from '../TimeSeriesChart.svelte';
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

const streamWithData = {
  type: 'Heart Rate',
  data: [
    { time: 1000, value: 80 },
    { time: 2000, value: 90 },
  ] as { time: number; value: number }[],
};

describe('TimeSeriesChart', () => {
  afterEach(() => {
    resetChartMock();
  });

  describe('empty / no-data', () => {
    it('renders "No data available" when streamData has no data', () => {
      render(TimeSeriesChart, {
        props: {
          streamData: { type: 'Heart Rate', data: [] },
          activityStartDate: 1000,
        },
      });
      expect(screen.getByText(/No data available/)).toBeInTheDocument();
      expect(chartRegistry.configs).toHaveLength(0);
    });

    it('renders "No valid numeric data" when streamData has only non-numeric values', () => {
      render(TimeSeriesChart, {
        props: {
          streamData: {
            type: 'Heart Rate',
            data: [
              { time: 1000, value: { n: 1 } },
              { time: 2000, value: { n: 2 } },
            ],
          },
          activityStartDate: 1000,
        },
      });
      expect(screen.getByText(/No valid numeric data/)).toBeInTheDocument();
      expect(chartRegistry.configs).toHaveLength(0);
    });
  });

  describe('with data', () => {
    it('does not show "No data available" and renders chart container and Reset Zoom', () => {
      render(TimeSeriesChart, {
        props: {
          streamData: streamWithData,
          activityStartDate: 1000,
        },
      });
      expect(screen.queryByText(/No data available/)).not.toBeInTheDocument();
      expect(screen.queryByText(/No valid numeric data/)).not.toBeInTheDocument();
      expect(screen.getByText('Reset Zoom')).toBeInTheDocument();
    });

    it('Reset Zoom button is present and initially hidden when not zoomed', () => {
      render(TimeSeriesChart, {
        props: {
          streamData: streamWithData,
          activityStartDate: 1000,
        },
      });
      const resetBtn = screen.getByText('Reset Zoom').closest('button');
      expect(resetBtn).toBeInTheDocument();
      expect(resetBtn).toHaveStyle({ display: 'none' });
    });
  });

  describe('chart configuration', () => {
    it('creates one line dataset of elapsed-time points from the stream values', () => {
      render(TimeSeriesChart, {
        props: {
          streamData: streamWithData,
          activityStartDate: 1000,
        },
      });
      const config = getLastChartConfig();
      expect(config.type).toBe('line');
      expect(config.data.datasets).toHaveLength(1);
      expect(config.data.datasets[0].label).toBe(getStreamConfig('Heart Rate').label);
      expect(config.data.datasets[0].data).toEqual([
        { x: 0, y: 80 },
        { x: 1000, y: 90 },
      ]);
    });

    it('uses a linear x axis spanning the elapsed range', () => {
      render(TimeSeriesChart, {
        props: {
          streamData: streamWithData,
          activityStartDate: 1000,
        },
      });
      const xScale = getLastChartConfig().options.scales.x;
      expect(xScale.type).toBe('linear');
      expect(xScale.min).toBe(0);
      expect(xScale.max).toBe(1000);
    });

    it('titles the y axis with the stream label and unit', () => {
      render(TimeSeriesChart, {
        props: {
          streamData: streamWithData,
          activityStartDate: 1000,
        },
      });
      const { label, unit } = getStreamConfig('Heart Rate');
      expect(getLastChartConfig().options.scales.y.title?.text).toBe(
        unit ? `${label} (${unit})` : label
      );
    });

    it('enables drag zoom on the x axis only, with the shared drag style', () => {
      render(TimeSeriesChart, {
        props: {
          streamData: streamWithData,
          activityStartDate: 1000,
        },
      });
      const zoom = getLastChartConfig().options.plugins.zoom?.zoom;
      expect(zoom?.mode).toBe('x');
      expect(zoom?.drag).toEqual(ZOOM_DRAG_OPTIONS);
    });

    it('formats the tooltip title as elapsed time', () => {
      render(TimeSeriesChart, {
        props: {
          streamData: streamWithData,
          activityStartDate: 1000,
        },
      });
      const title = getLastChartConfig().options.plugins.tooltip?.callbacks?.title;
      expect(title?.([{ datasetIndex: 0, dataset: {}, parsed: { x: 125000, y: 0 } }])).toBe('2:05');
    });
  });

  describe('zoom and reset flow', () => {
    it('disables animation for zoom and reset transitions', () => {
      render(TimeSeriesChart, {
        props: {
          streamData: streamWithData,
          activityStartDate: 1000,
        },
      });
      expect(getLastChartConfig().options.transitions?.zoom?.animation?.duration).toBe(0);
    });

    it('shows Reset Zoom after a zoom completes and hides it after reset', async () => {
      render(TimeSeriesChart, {
        props: {
          streamData: streamWithData,
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

  describe('viewport decimation', () => {
    it('registers exactly one local viewport decimation plugin and no built-in decimation', () => {
      render(TimeSeriesChart, {
        props: {
          streamData: streamWithData,
          activityStartDate: 1000,
        },
      });
      const config = getLastChartConfig();
      expect(config.plugins).toHaveLength(1);
      expect(config.plugins?.[0].id).toBe('viewportDecimation');
      expect(config.options.plugins).not.toHaveProperty('decimation');
    });
  });

  describe('effect and chart lifecycle', () => {
    it('destroys previous chart when streamData changes', async () => {
      const { rerender } = render(TimeSeriesChart, {
        props: {
          streamData: streamWithData,
          activityStartDate: 1000,
        },
      });
      await tick();
      const first = getLastChartInstance();
      rerender({
        streamData: {
          type: 'Cadence',
          data: [{ time: 1000, value: 90 }],
        },
        activityStartDate: 1000,
      });
      await tick();
      expect(first.destroy).toHaveBeenCalled();
      expect(getLastChartConfig().data.datasets[0].label).toBe(getStreamConfig('Cadence').label);
    });

    it('destroys the chart on unmount', async () => {
      const { unmount } = render(TimeSeriesChart, {
        props: {
          streamData: streamWithData,
          activityStartDate: 1000,
        },
      });
      await tick();
      const instance = getLastChartInstance();
      unmount();
      expect(instance.destroy).toHaveBeenCalled();
    });
  });
});
