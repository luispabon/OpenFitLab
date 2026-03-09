import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import ComparisonStatsTable from '../ComparisonStatsTable.svelte';
import { eventDetailFixture, eventDetailEvt2Fixture } from '../../../../test/fixtures/event-detail';

// Third event fixture for 3-event tests
const eventDetailEvt3Fixture = {
  event: {
    ...eventDetailFixture.event,
    id: 'evt-3',
    name: 'Third Run',
  },
  activities: [
    {
      ...eventDetailFixture.activities[0],
      id: 'act-3',
      eventID: 'evt-3',
      deviceName: 'Polar Vantage',
    },
  ],
};

function getActivityDeviceName(activity: { deviceName?: string }) {
  return activity.deviceName ?? 'Device';
}

describe('ComparisonStatsTable', () => {
  describe('without referenceEventId (no delta columns)', () => {
    it('renders Stat column and event columns with no delta column', () => {
      const events = [eventDetailFixture, eventDetailEvt2Fixture];
      const selectedActivities = { 'evt-1': 'act-1', 'evt-2': 'act-2' };
      const allStatTypes = ['Duration', 'Distance'];
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

      expect(screen.getByText('Stat')).toBeInTheDocument();
      expect(screen.getByText('Garmin Forerunner 945')).toBeInTheDocument();
      expect(screen.getByText('Wahoo Elemnt')).toBeInTheDocument();
      expect(screen.queryByText('Δ')).not.toBeInTheDocument();
      expect(calculateDelta).not.toHaveBeenCalled();
    });
  });

  describe('with referenceEventId (2 events)', () => {
    it('renders delta column and Ref badge on reference device', () => {
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
          referenceEventId: 'evt-1',
        },
      });

      expect(screen.getByText('Ref')).toBeInTheDocument();
      expect(screen.getByText('Δ')).toBeInTheDocument();
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
          referenceEventId: 'evt-1',
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
          referenceEventId: 'evt-1',
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
          referenceEventId: 'evt-1',
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
          referenceEventId: 'evt-1',
        },
      });

      const span = screen.getByText(/\+00:00/).closest('span');
      expect(span).toHaveClass('text-green-500');
      expect(span?.textContent).not.toMatch(/\(.*%\)/);
    });

    it('calls calculateDelta with (refValue, secValue) order', () => {
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
          referenceEventId: 'evt-1',
        },
      });

      expect(calculateDelta).toHaveBeenCalledWith(3600, 3600);
    });
  });

  describe('with referenceEventId (3 events)', () => {
    it('renders two delta columns for 3 events', () => {
      const events = [eventDetailFixture, eventDetailEvt2Fixture, eventDetailEvt3Fixture];
      const selectedActivities = { 'evt-1': 'act-1', 'evt-2': 'act-2', 'evt-3': 'act-3' };
      const allStatTypes = ['Duration'];
      const eventColors = ['#ef4444', '#3b82f6', '#10b981'];
      const calculateDelta = vi.fn(() => null);

      render(ComparisonStatsTable, {
        props: {
          events,
          selectedActivities,
          allStatTypes,
          eventColors,
          getActivityDeviceName,
          calculateDelta,
          referenceEventId: 'evt-1',
        },
      });

      // Should have 2 delta columns (one for evt-2, one for evt-3)
      const deltaHeaders = screen.getAllByText('Δ');
      expect(deltaHeaders).toHaveLength(2);
      // calculateDelta called twice (once per secondary with 1 stat type)
      expect(calculateDelta).toHaveBeenCalledTimes(2);
    });

    it('shows Ref badge on reference device when it is not the first', () => {
      const events = [eventDetailFixture, eventDetailEvt2Fixture, eventDetailEvt3Fixture];
      const selectedActivities = { 'evt-1': 'act-1', 'evt-2': 'act-2', 'evt-3': 'act-3' };
      const allStatTypes = ['Duration'];
      const eventColors = ['#ef4444', '#3b82f6', '#10b981'];
      const calculateDelta = vi.fn(() => null);

      render(ComparisonStatsTable, {
        props: {
          events,
          selectedActivities,
          allStatTypes,
          eventColors,
          getActivityDeviceName,
          calculateDelta,
          referenceEventId: 'evt-2',
        },
      });

      expect(screen.getByText('Ref')).toBeInTheDocument();
      // Only 2 delta columns (for evt-1 and evt-3, evt-2 is ref)
      const deltaHeaders = screen.getAllByText('Δ');
      expect(deltaHeaders).toHaveLength(2);
    });
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
