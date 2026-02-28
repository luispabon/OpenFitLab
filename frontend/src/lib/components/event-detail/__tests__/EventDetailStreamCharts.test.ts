import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import EventDetailStreamCharts from '../EventDetailStreamCharts.svelte';
import type { Activity, StreamData } from '../../../types';
import { activityFixture } from '../../../../test/fixtures/event-detail';

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

const heartRateStream: StreamData = {
  type: 'Heart Rate',
  data: [{ time: 1000, value: 80 }],
};

const defaultProps = {
  streamsLoading: false,
  streamsError: null as string | null,
  chartableStreams: [] as StreamData[],
  chartableStreamsOrdered: [] as StreamData[],
  selectedStreamTypes: new Set<string>(),
  viewMode: 'stacked' as const,
  visibleStreams: [] as StreamData[],
  activityStartDate: 1700000000000,
  activities: [activityFixture] as Activity[],
  selectedActivityId: null as string | null,
  hasSelectedActivity: true,
  onToggleStream: vi.fn(),
  onViewModeStacked: vi.fn(),
  onViewModeOverlay: vi.fn(),
  onSelectActivity: vi.fn(),
};

describe('EventDetailStreamCharts', () => {
  it('shows loading skeletons when streamsLoading is true', () => {
    render(EventDetailStreamCharts, {
      props: { ...defaultProps, streamsLoading: true },
    });
    expect(screen.getByText('Activity Metrics')).toBeInTheDocument();
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThanOrEqual(1);
  });

  it('shows error message when streamsError is set', () => {
    render(EventDetailStreamCharts, {
      props: {
        ...defaultProps,
        streamsError: 'Failed to load streams',
      },
    });
    expect(screen.getByText('Failed to load streams')).toBeInTheDocument();
    expect(screen.getByText(/Charts will not be available for this activity/)).toBeInTheDocument();
  });

  it('shows activity selector and calls onSelectActivity when multiple activities', async () => {
    const activity2: Activity = {
      ...activityFixture,
      id: 'act-2',
      name: 'Evening Run',
    };
    const onSelectActivity = vi.fn();
    render(EventDetailStreamCharts, {
      props: {
        ...defaultProps,
        chartableStreams: [heartRateStream],
        chartableStreamsOrdered: [heartRateStream],
        activities: [activityFixture, activity2],
        selectedActivityId: activityFixture.id,
        onSelectActivity,
      },
    });
    expect(screen.getByRole('button', { name: 'Morning Run' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Evening Run' })).toBeInTheDocument();
    await fireEvent.click(screen.getByRole('button', { name: 'Evening Run' }));
    expect(onSelectActivity).toHaveBeenCalledWith('act-2');
  });

  it('shows OverlayChart when viewMode is overlay and visibleStreams has data', () => {
    render(EventDetailStreamCharts, {
      props: {
        ...defaultProps,
        chartableStreams: [heartRateStream],
        chartableStreamsOrdered: [heartRateStream],
        selectedStreamTypes: new Set(['Heart Rate']),
        viewMode: 'overlay',
        visibleStreams: [heartRateStream],
      },
    });
    expect(screen.getByText('Overlay')).toBeInTheDocument();
    expect(screen.getByText('Stacked')).toBeInTheDocument();
    expect(screen.getByText('Reset Zoom')).toBeInTheDocument();
  });

  it('shows TimeSeriesChart(s) when viewMode is stacked and visibleStreams has data', () => {
    render(EventDetailStreamCharts, {
      props: {
        ...defaultProps,
        chartableStreams: [heartRateStream],
        chartableStreamsOrdered: [heartRateStream],
        selectedStreamTypes: new Set(['Heart Rate']),
        viewMode: 'stacked',
        visibleStreams: [heartRateStream],
      },
    });
    expect(screen.getByText('Reset Zoom')).toBeInTheDocument();
  });

  it('shows "Select metrics above to view charts" when chartableStreams exist but none selected', () => {
    render(EventDetailStreamCharts, {
      props: {
        ...defaultProps,
        chartableStreams: [heartRateStream],
        chartableStreamsOrdered: [heartRateStream],
        selectedStreamTypes: new Set(),
        visibleStreams: [],
      },
    });
    expect(screen.getByText('Select metrics above to view charts')).toBeInTheDocument();
  });

  it('shows stream type buttons and calls onToggleStream when clicked', async () => {
    const onToggleStream = vi.fn();
    render(EventDetailStreamCharts, {
      props: {
        ...defaultProps,
        chartableStreams: [heartRateStream],
        chartableStreamsOrdered: [heartRateStream],
        onToggleStream,
      },
    });
    const heartRateBtn = screen.getByRole('button', { name: 'Heart Rate' });
    expect(heartRateBtn).toBeInTheDocument();
    await fireEvent.click(heartRateBtn);
    expect(onToggleStream).toHaveBeenCalledWith('Heart Rate');
  });

  it('shows View Stacked/Overlay buttons and calls onViewModeStacked and onViewModeOverlay', async () => {
    const onViewModeStacked = vi.fn();
    const onViewModeOverlay = vi.fn();
    render(EventDetailStreamCharts, {
      props: {
        ...defaultProps,
        chartableStreams: [heartRateStream],
        chartableStreamsOrdered: [heartRateStream],
        onViewModeStacked,
        onViewModeOverlay,
      },
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Overlay' }));
    expect(onViewModeOverlay).toHaveBeenCalledTimes(1);
    await fireEvent.click(screen.getByRole('button', { name: 'Stacked' }));
    expect(onViewModeStacked).toHaveBeenCalledTimes(1);
  });

  it('shows "No stream data available" when hasSelectedActivity and no chartableStreams', () => {
    render(EventDetailStreamCharts, {
      props: {
        ...defaultProps,
        chartableStreams: [],
        chartableStreamsOrdered: [],
        hasSelectedActivity: true,
      },
    });
    expect(screen.getByText('No stream data available')).toBeInTheDocument();
    expect(screen.getByText(/This activity does not contain time-series data/)).toBeInTheDocument();
  });
});
