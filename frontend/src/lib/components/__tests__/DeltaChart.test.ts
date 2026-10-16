import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import DeltaChart from '../DeltaChart.svelte';
import {
  chartRegistry,
  getLastChartConfig,
  getLastChartInstance,
  resetChartMock,
} from '../../../test/chartjs-mock';

vi.mock('chart.js', async () => (await import('../../../test/chartjs-mock')).chartJsModuleMock());
vi.mock('chartjs-plugin-zoom', () => ({ default: { id: 'zoom' } }));

const deltaProps = {
  deltaSeries: [
    { x: 0, y: 2 },
    { x: 1000, y: -3 },
  ],
  label: 'Heart Rate delta',
  color: '#3b82f6',
  unit: 'bpm',
};

describe('DeltaChart', () => {
  afterEach(() => {
    resetChartMock();
  });

  it('renders "No delta data" when deltaSeries is empty', () => {
    render(DeltaChart, {
      props: {
        deltaSeries: [],
        label: 'Heart Rate delta',
        color: '#3b82f6',
        unit: 'bpm',
      },
    });
    expect(screen.getByText(/No delta data/)).toBeInTheDocument();
    expect(chartRegistry.configs).toHaveLength(0);
  });

  it('renders chart container when deltaSeries has data', async () => {
    render(DeltaChart, { props: deltaProps });
    await tick();
    expect(screen.queryByText(/No delta data/)).not.toBeInTheDocument();
  });

  it('empty state uses 300px height', () => {
    render(DeltaChart, {
      props: {
        deltaSeries: [],
        label: 'Heart Rate delta',
        color: '#3b82f6',
        unit: 'bpm',
      },
    });
    const el = screen.getByText(/No delta data/).closest('div[style]');
    expect(el).toHaveAttribute('style', 'height: 300px;');
  });

  describe('chart configuration', () => {
    it('creates a single line dataset from the delta points', () => {
      render(DeltaChart, { props: deltaProps });
      const config = getLastChartConfig();
      expect(config.type).toBe('line');
      expect(config.data.datasets).toHaveLength(1);
      expect(config.data.datasets[0].label).toBe('Heart Rate delta');
      expect(config.data.datasets[0].data).toEqual([
        { x: 0, y: 2 },
        { x: 1000, y: -3 },
      ]);
    });

    it('uses a linear x axis that auto-scales to the data', () => {
      render(DeltaChart, { props: deltaProps });
      const xScale = getLastChartConfig().options.scales.x;
      expect(xScale.type).toBe('linear');
      expect(xScale.min).toBeUndefined();
      expect(xScale.max).toBeUndefined();
    });

    it('titles the y axis with the label and unit, and formats ticks to one decimal', () => {
      render(DeltaChart, { props: deltaProps });
      const yScale = getLastChartConfig().options.scales.y;
      expect(yScale.title?.text).toBe('Heart Rate delta (bpm)');
      expect(yScale.ticks?.callback?.(3.14159)).toBe('3.1');
    });

    it('does not enable zoom', () => {
      render(DeltaChart, { props: deltaProps });
      expect(getLastChartConfig().options.plugins.zoom).toBeUndefined();
      expect(screen.queryByText('Reset Zoom')).not.toBeInTheDocument();
    });
  });

  it('destroys chart on unmount', async () => {
    const { unmount } = render(DeltaChart, {
      props: {
        deltaSeries: [{ x: 0, y: 1 }],
        label: 'HR delta',
        color: '#3b82f6',
        unit: 'bpm',
      },
    });
    await tick();
    const instance = getLastChartInstance();
    unmount();
    expect(instance.destroy).toHaveBeenCalled();
  });
});
