import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import ScatterChart from '../ScatterChart.svelte';
import {
  chartRegistry,
  getLastChartConfig,
  getLastChartInstance,
  resetChartMock,
} from '../../../test/chartjs-mock';

vi.mock('chart.js', async () => (await import('../../../test/chartjs-mock')).chartJsModuleMock());
vi.mock('chartjs-plugin-zoom', () => ({ default: { id: 'zoom' } }));

describe('ScatterChart', () => {
  afterEach(() => {
    resetChartMock();
  });

  it('renders "No data" when pairs is empty', () => {
    render(ScatterChart, {
      props: {
        pairs: [],
        regressionLine: null,
        xLabel: 'Reference HR (bpm)',
        yLabel: 'Secondary HR (bpm)',
        color: '#ef4444',
      },
    });
    expect(screen.getByText(/No data/)).toBeInTheDocument();
    expect(chartRegistry.configs).toHaveLength(0);
  });

  it('renders chart container when pairs are provided', async () => {
    render(ScatterChart, {
      props: {
        pairs: [
          { x: 100, y: 102 },
          { x: 110, y: 112 },
        ],
        regressionLine: { slope: 1.02, intercept: 0 },
        xLabel: 'Reference HR (bpm)',
        yLabel: 'Secondary HR (bpm)',
        color: '#ef4444',
      },
    });
    await tick();
    expect(screen.queryByText(/No data/)).not.toBeInTheDocument();
  });

  it('renders chart without regression line when regressionLine is null', async () => {
    render(ScatterChart, {
      props: {
        pairs: [{ x: 100, y: 102 }],
        regressionLine: null,
        xLabel: 'X',
        yLabel: 'Y',
        color: '#3b82f6',
      },
    });
    await tick();
    expect(screen.queryByText(/No data/)).not.toBeInTheDocument();
  });

  describe('chart configuration', () => {
    const pairs = [
      { x: 100, y: 102 },
      { x: 110, y: 112 },
    ];

    it('builds Data, Regression, and Equal readings datasets when a regression line is given', () => {
      render(ScatterChart, {
        props: {
          pairs,
          regressionLine: { slope: 2, intercept: 1 },
          xLabel: 'X',
          yLabel: 'Y',
          color: '#ef4444',
        },
      });
      const config = getLastChartConfig();
      expect(config.type).toBe('scatter');
      expect(config.data.datasets.map((d) => d.label)).toEqual([
        'Data',
        'Regression',
        'Equal readings',
      ]);
      expect(config.data.datasets[0].data).toEqual([
        { x: 100, y: 102 },
        { x: 110, y: 112 },
      ]);
      expect(config.data.datasets[1].data).toEqual([
        { x: 100, y: 201 },
        { x: 110, y: 221 },
      ]);
      expect(config.data.datasets[1].showLine).toBe(true);
    });

    it('omits the Regression dataset when regressionLine is null', () => {
      render(ScatterChart, {
        props: {
          pairs,
          regressionLine: null,
          xLabel: 'X',
          yLabel: 'Y',
          color: '#ef4444',
        },
      });
      expect(getLastChartConfig().data.datasets.map((d) => d.label)).toEqual([
        'Data',
        'Equal readings',
      ]);
    });

    it('sorts points by x and uses shared bounds over x and y on both axes', () => {
      render(ScatterChart, {
        props: {
          pairs: [
            { x: 110, y: 112 },
            { x: 100, y: 130 },
          ],
          regressionLine: null,
          xLabel: 'X',
          yLabel: 'Y',
          color: '#ef4444',
        },
      });
      const config = getLastChartConfig();
      expect(config.data.datasets[0].data).toEqual([
        { x: 100, y: 130 },
        { x: 110, y: 112 },
      ]);
      expect(config.options.scales.x.min).toBe(100);
      expect(config.options.scales.x.max).toBe(130);
      expect(config.options.scales.y.min).toBe(100);
      expect(config.options.scales.y.max).toBe(130);
    });

    it('draws the Equal readings line y = x across the shared bounds', () => {
      render(ScatterChart, {
        props: {
          pairs: [
            { x: 110, y: 112 },
            { x: 100, y: 130 },
          ],
          regressionLine: null,
          xLabel: 'X',
          yLabel: 'Y',
          color: '#ef4444',
        },
      });
      const equal = getLastChartConfig().data.datasets[1];
      expect(equal.label).toBe('Equal readings');
      expect(equal.showLine).toBe(true);
      expect(equal.data).toEqual([
        { x: 100, y: 100 },
        { x: 130, y: 130 },
      ]);
    });

    it('shows only the first Data item in the tooltip', () => {
      render(ScatterChart, {
        props: {
          pairs,
          regressionLine: { slope: 2, intercept: 1 },
          xLabel: 'X',
          yLabel: 'Y',
          color: '#ef4444',
        },
      });
      const filter = getLastChartConfig().options.plugins.tooltip?.filter;
      const regression = { datasetIndex: 1, dataset: {}, parsed: { x: 100, y: 201 } };
      const first = { datasetIndex: 0, dataset: {}, parsed: { x: 100, y: 102 } };
      const duplicate = { datasetIndex: 0, dataset: {}, parsed: { x: 100, y: 102 } };
      const items = [regression, first, duplicate];
      expect(filter?.(regression, 0, items)).toBe(false);
      expect(filter?.(first, 1, items)).toBe(true);
      expect(filter?.(duplicate, 2, items)).toBe(false);
    });

    it('labels tooltip items with the dataset label and one-decimal coordinates', () => {
      render(ScatterChart, {
        props: {
          pairs,
          regressionLine: null,
          xLabel: 'X',
          yLabel: 'Y',
          color: '#ef4444',
        },
      });
      const label = getLastChartConfig().options.plugins.tooltip?.callbacks?.label;
      expect(
        label?.({ datasetIndex: 0, dataset: { label: 'Data' }, parsed: { x: 100.04, y: 102.25 } })
      ).toBe('Data: (100.0, 102.3)');
    });

    it('does not enable zoom', () => {
      render(ScatterChart, {
        props: {
          pairs,
          regressionLine: null,
          xLabel: 'X',
          yLabel: 'Y',
          color: '#ef4444',
        },
      });
      expect(getLastChartConfig().options.plugins.zoom).toBeUndefined();
    });
  });

  it('destroys chart on unmount', async () => {
    const { unmount } = render(ScatterChart, {
      props: {
        pairs: [{ x: 100, y: 102 }],
        regressionLine: null,
        xLabel: 'X',
        yLabel: 'Y',
        color: '#3b82f6',
      },
    });
    await tick();
    const instance = getLastChartInstance();
    unmount();
    expect(instance.destroy).toHaveBeenCalled();
  });
});
