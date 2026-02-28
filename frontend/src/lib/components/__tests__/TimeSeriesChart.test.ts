import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import TimeSeriesChart from '../TimeSeriesChart.svelte';

vi.mock('uplot', () => {
  const instance = {
    destroy: vi.fn(),
    batch: vi.fn((fn: () => void) => {
      if (fn) fn();
    }),
    setSize: vi.fn(),
    setScale: vi.fn(),
  };
  (globalThis as { __timeSeriesChartMock?: { instance: typeof instance } }).__timeSeriesChartMock =
    {
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

function getTimeSeriesChartMock() {
  return (
    globalThis as {
      __timeSeriesChartMock?: {
        instance: {
          destroy: ReturnType<typeof vi.fn>;
          batch: ReturnType<typeof vi.fn>;
          setScale: ReturnType<typeof vi.fn>;
        };
      };
    }
  ).__timeSeriesChartMock!;
}

const streamWithData = {
  type: 'Heart Rate',
  data: [
    { time: 1000, value: 80 },
    { time: 2000, value: 90 },
  ] as { time: number; value: number }[],
};

describe('TimeSeriesChart', () => {
  describe('empty / no-data', () => {
    it('renders "No data available" when streamData has no data', () => {
      render(TimeSeriesChart, {
        props: {
          streamData: { type: 'Heart Rate', data: [] },
          activityStartDate: 1000,
        },
      });
      expect(screen.getByText(/No data available/)).toBeInTheDocument();
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

  describe('effect and chart lifecycle', () => {
    it('resetZoom button click calls batch and setScale when chart exists', async () => {
      render(TimeSeriesChart, {
        props: {
          streamData: streamWithData,
          activityStartDate: 1000,
        },
      });
      await tick();
      const resetBtn = screen.getByText('Reset Zoom').closest('button');
      expect(resetBtn).toBeInTheDocument();
      resetBtn!.click();
      expect(getTimeSeriesChartMock().instance.batch).toHaveBeenCalled();
      expect(getTimeSeriesChartMock().instance.setScale).toHaveBeenCalledWith(
        'x',
        expect.any(Object)
      );
    });

    it('destroys previous chart when streamData changes (chartRef.current path)', async () => {
      const { rerender } = render(TimeSeriesChart, {
        props: {
          streamData: streamWithData,
          activityStartDate: 1000,
        },
      });
      await tick();
      const destroyCallsBefore = getTimeSeriesChartMock().instance.destroy.mock.calls.length;
      rerender({
        streamData: {
          type: 'Cadence',
          data: [{ time: 1000, value: 90 }],
        },
        activityStartDate: 1000,
      });
      await tick();
      expect(getTimeSeriesChartMock().instance.destroy.mock.calls.length).toBeGreaterThan(
        destroyCallsBefore
      );
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

      const { unmount } = render(TimeSeriesChart, {
        props: {
          streamData: streamWithData,
          activityStartDate: 1000,
        },
      });
      unmount();

      expect(getTimeSeriesChartMock().instance.destroy).toHaveBeenCalled();
      expect(disconnectSpy).toHaveBeenCalled();
      window.ResizeObserver = OriginalRO;
    });
  });
});
