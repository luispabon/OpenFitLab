import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import ComparisonChart from '../ComparisonChart.svelte';
import type { ComparisonChartEntry } from '../../utils/comparison-chart-data';
import type uPlot from 'uplot';

interface ComparisonChartMockRef {
  lastOptsRef: { current: uPlot.Options | null };
  instance: {
    destroy: ReturnType<typeof vi.fn>;
    batch: ReturnType<typeof vi.fn>;
    setSize: ReturnType<typeof vi.fn>;
    setScale: ReturnType<typeof vi.fn>;
  };
}

vi.mock('uplot', () => {
  const lastOptsRef = { current: null as uPlot.Options | null };
  const instance = {
    destroy: vi.fn(),
    batch: vi.fn((fn: () => void) => {
      if (fn) fn();
    }),
    setSize: vi.fn(),
    setScale: vi.fn(),
  };
  (globalThis as { __comparisonChartMock?: ComparisonChartMockRef }).__comparisonChartMock = {
    lastOptsRef,
    instance,
  };
  const Mock = vi.fn(function (
    _this: unknown,
    opts: uPlot.Options,
    _data: uPlot.AlignedData,
    _container: HTMLElement
  ) {
    lastOptsRef.current = opts;
    return instance;
  });
  (Mock as unknown as { paths: Record<string, () => () => void> }).paths = {
    spline: () => () => {},
    linear: () => () => {},
  };
  return { default: Mock };
});

function getChartMock(): ComparisonChartMockRef {
  return (globalThis as { __comparisonChartMock?: ComparisonChartMockRef }).__comparisonChartMock!;
}

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

  describe('props passed through', () => {
    it('renders chart with xAxisMode wall-clock', () => {
      render(ComparisonChart, {
        props: {
          streamType: 'Heart Rate',
          entries: [
            entry(1000, [{ time: 1000, value: 80 }]),
            entry(2000, [{ time: 2000, value: 90 }]),
          ],
          xAxisMode: 'wall-clock',
        },
      });
      expect(screen.queryByText(/No data available/)).not.toBeInTheDocument();
      expect(screen.getByText('Reset Zoom')).toBeInTheDocument();
    });

    it('renders chart with xAxisMode elapsed', () => {
      render(ComparisonChart, {
        props: {
          streamType: 'Heart Rate',
          entries: [
            entry(1000, [{ time: 1000, value: 80 }]),
            entry(2000, [{ time: 2000, value: 90 }]),
          ],
          xAxisMode: 'elapsed',
        },
      });
      expect(screen.queryByText(/No data available/)).not.toBeInTheDocument();
      expect(screen.getByText('Reset Zoom')).toBeInTheDocument();
    });
  });

  describe('effect and chart lifecycle', () => {
    it('destroys previous chart when entries change (chartRef.current path)', async () => {
      const { rerender } = render(ComparisonChart, {
        props: {
          streamType: 'Heart Rate',
          entries: [entry(1000, [{ time: 1000, value: 80 }])],
          xAxisMode: 'elapsed',
        },
      });
      await tick();
      const destroyCallsBefore = getChartMock().instance.destroy.mock.calls.length;
      rerender({
        streamType: 'Heart Rate',
        entries: [
          entry(1000, [{ time: 1000, value: 80 }]),
          entry(2000, [{ time: 2000, value: 90 }]),
        ],
        xAxisMode: 'elapsed',
      });
      await tick();
      expect(getChartMock().instance.destroy.mock.calls.length).toBeGreaterThan(destroyCallsBefore);
    });

    it('resetZoom button click calls batch and setScale when chart exists', async () => {
      render(ComparisonChart, {
        props: {
          streamType: 'Heart Rate',
          entries: [
            entry(1000, [
              { time: 1000, value: 80 },
              { time: 2000, value: 90 },
            ]),
          ],
          xAxisMode: 'elapsed',
        },
      });
      await tick();
      const resetBtn = screen.getByText('Reset Zoom').closest('button');
      expect(resetBtn).toBeInTheDocument();
      resetBtn!.click();
      expect(getChartMock().instance.batch).toHaveBeenCalled();
      expect(getChartMock().instance.setScale).toHaveBeenCalledWith('x', expect.any(Object));
    });

    it('cleanup on unmount calls destroy and ResizeObserver disconnect', () => {
      const disconnectSpy = vi.fn();
      const OriginalRO = window.ResizeObserver;
      window.ResizeObserver = class {
        observe = vi.fn();
        disconnect = disconnectSpy;
        unobserve = vi.fn();
        constructor(_cb: ResizeObserverCallback) {}
      } as unknown as typeof ResizeObserver;

      const { unmount } = render(ComparisonChart, {
        props: {
          streamType: 'Heart Rate',
          entries: [entry(1000, [{ time: 1000, value: 80 }])],
          xAxisMode: 'elapsed',
        },
      });
      unmount();

      expect(getChartMock().instance.destroy).toHaveBeenCalled();
      expect(disconnectSpy).toHaveBeenCalled();
      window.ResizeObserver = OriginalRO;
    });
  });
});
