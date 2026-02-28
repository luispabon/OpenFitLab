import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import OverlayChart from '../OverlayChart.svelte';
import { emptyStreamsFixture, streamsWithNumericFixture } from '../../../test/fixtures/streams';

vi.mock('uplot', () => {
  const mockInstance = {
    destroy: vi.fn(),
    batch: vi.fn((fn: () => void) => {
      if (fn) fn();
    }),
    setSize: vi.fn(),
    setScale: vi.fn(),
  };
  const Mock = vi.fn(function (this: unknown) {
    return mockInstance;
  });
  (Mock as unknown as { paths: Record<string, () => () => void> }).paths = {
    spline: () => () => {},
    linear: () => () => {},
  };
  return { default: Mock };
});

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
  });
});
