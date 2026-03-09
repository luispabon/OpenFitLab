import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import ScatterChart from '../ScatterChart.svelte';

vi.mock('uplot', () => {
  const instance = {
    destroy: vi.fn(),
    setSize: vi.fn(),
  };
  (globalThis as { __scatterChartMock?: { instance: typeof instance } }).__scatterChartMock = {
    instance,
  };
  const Mock = vi.fn(function (this: unknown) {
    return instance;
  });
  (Mock as unknown as { paths: Record<string, () => () => void> }).paths = {
    spline: () => () => {},
    linear: () => () => {},
  };
  return { default: Mock };
});

function getMock() {
  return (
    globalThis as { __scatterChartMock?: { instance: { destroy: ReturnType<typeof vi.fn> } } }
  ).__scatterChartMock!;
}

describe('ScatterChart', () => {
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
    unmount();
    expect(getMock().instance.destroy).toHaveBeenCalled();
  });
});
