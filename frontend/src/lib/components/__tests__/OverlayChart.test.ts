import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import OverlayChart from '../OverlayChart.svelte';
import { emptyStreamsFixture, streamsWithNumericFixture } from '../../../test/fixtures/streams';

vi.mock('uplot', () => {
  const instance = {
    destroy: vi.fn(),
    batch: vi.fn((fn: () => void) => {
      if (fn) fn();
    }),
    setSize: vi.fn(),
    setScale: vi.fn(),
  };
  (globalThis as { __overlayChartMock?: { instance: typeof instance } }).__overlayChartMock = {
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

function getOverlayChartMock() {
  return (globalThis as { __overlayChartMock?: { instance: { destroy: ReturnType<typeof vi.fn>; batch: ReturnType<typeof vi.fn>; setScale: ReturnType<typeof vi.fn> } } })
    .__overlayChartMock!;
}

describe('OverlayChart', () => {
  describe('empty / no-data', () => {
    it('renders "No data available" when streams is empty', () => {
      render(OverlayChart, {
        props: {
          streams: emptyStreamsFixture,
          activityStartDate: 1000,
        },
      });
      expect(screen.getByText(/No data available/)).toBeInTheDocument();
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

  describe('props', () => {
    it('accepts streams and activityStartDate and uses them', () => {
      render(OverlayChart, {
        props: {
          streams: streamsWithNumericFixture,
          activityStartDate: 500,
        },
      });
      expect(screen.queryByText(/No data available/)).not.toBeInTheDocument();
      expect(screen.getByText('Reset Zoom')).toBeInTheDocument();
    });

    it('renders with two streams (two Y scales / right axis path)', () => {
      const twoStreams = [
        { type: 'Heart Rate', data: [{ time: 1000, value: 80 }] as { time: number; value: number }[] },
        { type: 'Cadence', data: [{ time: 1000, value: 90 }] as { time: number; value: number }[] },
      ];
      render(OverlayChart, {
        props: {
          streams: twoStreams,
          activityStartDate: 1000,
        },
      });
      expect(screen.queryByText(/No data available/)).not.toBeInTheDocument();
      expect(screen.getByText('Reset Zoom')).toBeInTheDocument();
    });
  });

  describe('effect and chart lifecycle', () => {
    it('resetZoom button click calls batch and setScale when chart exists', async () => {
      render(OverlayChart, {
        props: {
          streams: streamsWithNumericFixture,
          activityStartDate: 1000,
        },
      });
      await tick();
      const resetBtn = screen.getByText('Reset Zoom').closest('button');
      expect(resetBtn).toBeInTheDocument();
      resetBtn!.click();
      expect(getOverlayChartMock().instance.batch).toHaveBeenCalled();
      expect(getOverlayChartMock().instance.setScale).toHaveBeenCalledWith('x', expect.any(Object));
    });

    it('destroys previous chart when streams change (chartRef.current path)', async () => {
      const { rerender } = render(OverlayChart, {
        props: {
          streams: streamsWithNumericFixture,
          activityStartDate: 1000,
        },
      });
      await tick();
      const destroyCallsBefore = getOverlayChartMock().instance.destroy.mock.calls.length;
      rerender({
        streams: [
          { type: 'Heart Rate', data: [{ time: 1000, value: 80 }] },
          { type: 'Cadence', data: [{ time: 1000, value: 90 }] },
        ],
        activityStartDate: 1000,
      });
      await tick();
      expect(getOverlayChartMock().instance.destroy.mock.calls.length).toBeGreaterThan(
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

      const { unmount } = render(OverlayChart, {
        props: {
          streams: streamsWithNumericFixture,
          activityStartDate: 1000,
        },
      });
      unmount();

      expect(getOverlayChartMock().instance.destroy).toHaveBeenCalled();
      expect(disconnectSpy).toHaveBeenCalled();
      window.ResizeObserver = OriginalRO;
    });
  });
});
