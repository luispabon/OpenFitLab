import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import ComparisonStatsTable from '../ComparisonStatsTable.svelte';
import { eventDetailFixture, eventDetailEvt2Fixture } from '../../../../test/fixtures/event-detail';

function getActivityDeviceName(activity: { deviceName?: string }) {
  return activity.deviceName ?? 'Device';
}

describe('ComparisonStatsTable', () => {
  it('renders Stat column and event columns with device names when two events', () => {
    const events = [eventDetailFixture, eventDetailEvt2Fixture];
    const selectedActivities = { 'evt-1': 'act-1', 'evt-2': 'act-2' };
    const allStatTypes = ['Duration', 'Distance', 'Average Heart Rate'];
    const eventColors = ['#ef4444', '#3b82f6'];
    const calculateDelta = vi.fn((_v1: unknown, _v2: unknown) => null);

    render(ComparisonStatsTable, {
      props: {
        events,
        selectedActivities,
        allStatTypes,
        eventColors,
        getActivityDeviceName,
        calculateDelta,
      },
    });

    expect(screen.getByText('Stat')).toBeInTheDocument();
    expect(screen.getByText('Garmin Forerunner 945')).toBeInTheDocument();
    expect(screen.getByText('Wahoo Elemnt')).toBeInTheDocument();
    expect(screen.getByText('Delta')).toBeInTheDocument();
  });

  it('renders delta with plus and green class when absolute >= 0 and percent !== 0', () => {
    const events = [eventDetailFixture, eventDetailEvt2Fixture];
    const selectedActivities = { 'evt-1': 'act-1', 'evt-2': 'act-2' };
    const allStatTypes = ['Duration'];
    const eventColors = ['#ef4444', '#3b82f6'];
    const calculateDelta = vi.fn(() => ({ absolute: 300, percent: 8.3 }));

    render(ComparisonStatsTable, {
      props: {
        events,
        selectedActivities,
        allStatTypes,
        eventColors,
        getActivityDeviceName,
        calculateDelta,
      },
    });

    const deltaCell = screen.getByText(/\+.*05:00/);
    expect(deltaCell).toBeInTheDocument();
    expect(deltaCell.closest('span')).toHaveClass('text-green-500');
    expect(deltaCell.textContent).toMatch(/\+8\.3%/);
  });

  it('renders delta with minus and red class when absolute < 0', () => {
    const events = [eventDetailFixture, eventDetailEvt2Fixture];
    const selectedActivities = { 'evt-1': 'act-1', 'evt-2': 'act-2' };
    const allStatTypes = ['Distance'];
    const eventColors = ['#ef4444', '#3b82f6'];
    const calculateDelta = vi.fn(() => ({ absolute: -500, percent: -5.0 }));

    render(ComparisonStatsTable, {
      props: {
        events,
        selectedActivities,
        allStatTypes,
        eventColors,
        getActivityDeviceName,
        calculateDelta,
      },
    });

    const deltaCell = screen.getByText(/-500/);
    expect(deltaCell).toBeInTheDocument();
    expect(deltaCell.closest('span')).toHaveClass('text-red-500');
    expect(deltaCell.textContent).toMatch(/-5\.0%/);
  });

  it('renders em dash when calculateDelta returns null', () => {
    const events = [eventDetailFixture, eventDetailEvt2Fixture];
    const selectedActivities = { 'evt-1': 'act-1', 'evt-2': 'act-2' };
    const allStatTypes = ['Average Heart Rate'];
    const eventColors = ['#ef4444', '#3b82f6'];
    const calculateDelta = vi.fn(() => null);

    render(ComparisonStatsTable, {
      props: {
        events,
        selectedActivities,
        allStatTypes,
        eventColors,
        getActivityDeviceName,
        calculateDelta,
      },
    });

    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('renders delta without percent when percent is 0', () => {
    const events = [eventDetailFixture, eventDetailEvt2Fixture];
    const selectedActivities = { 'evt-1': 'act-1', 'evt-2': 'act-2' };
    const allStatTypes = ['Duration'];
    const eventColors = ['#ef4444', '#3b82f6'];
    const calculateDelta = vi.fn(() => ({ absolute: 0, percent: 0 }));

    render(ComparisonStatsTable, {
      props: {
        events,
        selectedActivities,
        allStatTypes,
        eventColors,
        getActivityDeviceName,
        calculateDelta,
      },
    });

    const span = screen.getByText(/\+00:00/).closest('span');
    expect(span).toHaveClass('text-green-500');
    expect(span?.textContent).not.toMatch(/\(.*%\)/);
  });

  it('calls onHideStat with the stat type when hide button is clicked', async () => {
    const events = [eventDetailFixture, eventDetailEvt2Fixture];
    const selectedActivities = { 'evt-1': 'act-1', 'evt-2': 'act-2' };
    const allStatTypes = ['Duration'];
    const eventColors = ['#ef4444', '#3b82f6'];
    const calculateDelta = vi.fn(() => null);
    const onHideStat = vi.fn();

    render(ComparisonStatsTable, {
      props: {
        events,
        selectedActivities,
        allStatTypes,
        eventColors,
        getActivityDeviceName,
        calculateDelta,
        onHideStat,
      },
    });

    const hideBtn = screen.getByRole('button', { name: 'Hide Duration row' });
    expect(hideBtn).toBeInTheDocument();
    await fireEvent.click(hideBtn);
    expect(onHideStat).toHaveBeenCalledWith('Duration');
  });

  it('does not render hide button when onHideStat is not provided', () => {
    const events = [eventDetailFixture, eventDetailEvt2Fixture];
    const selectedActivities = { 'evt-1': 'act-1', 'evt-2': 'act-2' };
    const allStatTypes = ['Duration'];
    const eventColors = ['#ef4444', '#3b82f6'];
    const calculateDelta = vi.fn(() => null);

    render(ComparisonStatsTable, {
      props: {
        events,
        selectedActivities,
        allStatTypes,
        eventColors,
        getActivityDeviceName,
        calculateDelta,
      },
    });

    expect(screen.queryByRole('button', { name: /Hide Duration row/ })).not.toBeInTheDocument();
  });

  it('uses event name or Event N fallback when selected activity is not found', () => {
    const eventWithoutName = {
      ...eventDetailEvt2Fixture,
      event: { ...eventDetailEvt2Fixture.event, name: '' },
    };
    const events = [eventDetailFixture, eventWithoutName];
    const selectedActivities = { 'evt-1': 'act-1', 'evt-2': 'wrong-activity-id' };
    const allStatTypes = ['Duration'];
    const eventColors = ['#ef4444', '#3b82f6'];
    const calculateDelta = vi.fn(() => null);

    render(ComparisonStatsTable, {
      props: {
        events,
        selectedActivities,
        allStatTypes,
        eventColors,
        getActivityDeviceName,
        calculateDelta,
      },
    });

    expect(screen.getByText('Event 2')).toBeInTheDocument();
  });
});
