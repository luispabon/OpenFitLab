import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import ComparisonChart from '../ComparisonChart.svelte';
import type { ComparisonChartEntry } from '../../utils/comparison-chart-data';

beforeAll(() => {
  window.ResizeObserver = class ResizeObserver {
    observe = vi.fn();
    disconnect = vi.fn();
    unobserve = vi.fn();
    constructor(_callback: ResizeObserverCallback) {}
  };
});

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
          entries: [
            entry(1000, [{ time: 1000, value: 80 }]),
          ],
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
});
