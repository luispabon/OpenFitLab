import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { tick } from 'svelte';
import PowerCurveChart from '../PowerCurveChart.svelte';
import { CHART_POWER_COLOR, ZOOM_DRAG_OPTIONS } from '../../../utils/chart-utils';
import {
  chartRegistry,
  getLastChartConfig,
  getLastChartInstance,
  resetChartMock,
} from '../../../../test/chartjs-mock';

vi.mock('chart.js', async () =>
  (await import('../../../../test/chartjs-mock')).chartJsModuleMock()
);
vi.mock('chartjs-plugin-zoom', () => ({ default: { id: 'zoom' } }));

const singleSeries = [
  {
    activityId: 'act-1',
    activityName: 'Power',
    color: '#a855f7',
    data: [
      { duration: 1, power: 417 },
      { duration: 5, power: 411 },
      { duration: 60, power: 362 },
      { duration: 300, power: 335 },
    ],
  },
];

const multiSeries = [
  { ...singleSeries[0], activityId: 'act-1', activityName: 'Activity 1' },
  {
    activityId: 'act-2',
    activityName: 'Activity 2',
    color: '#3b82f6',
    data: [
      { duration: 1, power: 400 },
      { duration: 60, power: 350 },
      { duration: 300, power: 320 },
    ],
  },
];

describe('PowerCurveChart', () => {
  afterEach(() => {
    resetChartMock();
  });

  it('shows no power curve data message when series is empty', () => {
    render(PowerCurveChart, { props: { series: [] } });
    expect(screen.getByText('No power curve data')).toBeInTheDocument();
    expect(chartRegistry.configs).toHaveLength(0);
  });

  it('renders chart when single series is provided', () => {
    render(PowerCurveChart, { props: { series: singleSeries } });
    expect(document.querySelector('.h-96')).toBeInTheDocument();
    expect(screen.queryByText('No power curve data')).not.toBeInTheDocument();
  });

  it('renders chart when multiple series are provided', () => {
    render(PowerCurveChart, { props: { series: multiSeries } });
    expect(document.querySelector('.h-96')).toBeInTheDocument();
  });

  it('shows toggle buttons when showToggleButtons is true', () => {
    render(PowerCurveChart, {
      props: {
        series: multiSeries,
        showToggleButtons: true,
        selectedActivityIds: new Set(['act-1', 'act-2']),
        onToggleActivity: vi.fn(),
      },
    });
    expect(screen.getByRole('button', { name: 'Activity 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Activity 2' })).toBeInTheDocument();
  });

  it('calls onToggleActivity when toggle button is clicked', async () => {
    const onToggleActivity = vi.fn();
    render(PowerCurveChart, {
      props: {
        series: multiSeries,
        showToggleButtons: true,
        selectedActivityIds: new Set(['act-1', 'act-2']),
        onToggleActivity,
      },
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Activity 1' }));
    expect(onToggleActivity).toHaveBeenCalledWith('act-1');
  });

  it('shows "Select activities above" when showToggleButtons true and no visible series', () => {
    render(PowerCurveChart, {
      props: {
        series: multiSeries,
        showToggleButtons: true,
        selectedActivityIds: new Set(['other-id']),
        onToggleActivity: vi.fn(),
      },
    });
    expect(screen.getByText('Select activities above to view power curves')).toBeInTheDocument();
    expect(chartRegistry.configs).toHaveLength(0);
  });

  it('shows chart container when series is provided', () => {
    render(PowerCurveChart, { props: { series: singleSeries } });
    const chartContainer = document.querySelector('.h-96');
    expect(chartContainer).toBeInTheDocument();
  });

  describe('chart configuration', () => {
    it('uses a logarithmic duration axis from the first duration to maxDuration', () => {
      render(PowerCurveChart, { props: { series: singleSeries, maxDuration: 600 } });
      const xScale = getLastChartConfig().options.scales.x;
      expect(xScale.type).toBe('logarithmic');
      expect(xScale.min).toBe(1);
      expect(xScale.max).toBe(600);
      expect(xScale.title?.text).toBe('Duration');
    });

    it('uses the largest duration in the data as the x max when maxDuration is not given', () => {
      render(PowerCurveChart, { props: { series: singleSeries } });
      const xScale = getLastChartConfig().options.scales.x;
      expect(xScale.type).toBe('logarithmic');
      expect(xScale.min).toBe(1);
      expect(xScale.max).toBe(300);
    });

    it('plots power at each shared duration for one series', () => {
      render(PowerCurveChart, { props: { series: singleSeries } });
      const config = getLastChartConfig();
      expect(config.data.datasets).toHaveLength(1);
      expect(config.data.datasets[0].label).toBe('Power');
      expect(config.data.datasets[0].data).toEqual([
        { x: 1, y: 417 },
        { x: 5, y: 411 },
        { x: 60, y: 362 },
        { x: 300, y: 335 },
      ]);
    });

    it('fills gaps in one series with the nearest earlier power at the shared durations', () => {
      render(PowerCurveChart, { props: { series: multiSeries } });
      const config = getLastChartConfig();
      expect(config.data.datasets.map((d) => d.label)).toEqual(['Activity 1', 'Activity 2']);
      expect(config.data.datasets[1].data).toEqual([
        { x: 1, y: 400 },
        { x: 5, y: 400 },
        { x: 60, y: 350 },
        { x: 300, y: 320 },
      ]);
    });

    it('uses the default power color when a series has no color', () => {
      render(PowerCurveChart, {
        props: {
          series: [{ activityId: 'a', activityName: 'No color', data: singleSeries[0].data }],
        },
      });
      expect(getLastChartConfig().data.datasets[0].borderColor).toBe(CHART_POWER_COLOR);
    });

    it('enables drag zoom on the x axis only, with the shared drag style', () => {
      render(PowerCurveChart, { props: { series: singleSeries } });
      const zoom = getLastChartConfig().options.plugins.zoom?.zoom;
      expect(zoom?.mode).toBe('x');
      expect(zoom?.drag).toEqual(ZOOM_DRAG_OPTIONS);
    });

    it('formats the tooltip title as a compact duration', () => {
      render(PowerCurveChart, { props: { series: singleSeries } });
      const title = getLastChartConfig().options.plugins.tooltip?.callbacks?.title;
      expect(title?.([{ datasetIndex: 0, dataset: {}, parsed: { x: 60, y: 0 } }])).toBe('1m');
    });
  });

  describe('zoom and reset flow', () => {
    it('disables animation for zoom and reset transitions', () => {
      render(PowerCurveChart, { props: { series: singleSeries } });
      expect(getLastChartConfig().options.transitions?.zoom?.animation?.duration).toBe(0);
    });

    it('shows Reset Zoom after a zoom completes and hides it after reset', async () => {
      render(PowerCurveChart, { props: { series: singleSeries } });
      await tick();
      const instance = getLastChartInstance();
      const resetBtn = screen.getByText('Reset Zoom').closest('button')!;
      expect(resetBtn).toHaveStyle({ display: 'none' });

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
});
