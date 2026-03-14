import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import PowerCurveChart from '../PowerCurveChart.svelte';

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
  it('shows no power curve data message when series is empty', () => {
    render(PowerCurveChart, { props: { series: [] } });
    expect(screen.getByText('No power curve data')).toBeInTheDocument();
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
  });

  it('shows chart container when series is provided', () => {
    render(PowerCurveChart, { props: { series: singleSeries } });
    const chartContainer = document.querySelector('.h-96');
    expect(chartContainer).toBeInTheDocument();
  });
});
