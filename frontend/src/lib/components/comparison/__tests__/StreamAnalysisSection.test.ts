import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import StreamAnalysisSection from '../StreamAnalysisSection.svelte';
import { eventDetailFixture, eventDetailEvt2Fixture } from '../../../../test/fixtures/event-detail';

vi.mock('uplot', () => {
  const instance = {
    destroy: vi.fn(),
    setSize: vi.fn(),
    ctx: {
      save: vi.fn(),
      restore: vi.fn(),
      strokeStyle: '',
      lineWidth: 0,
      setLineDash: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
    },
    valToPos: vi.fn(() => 100),
    bbox: { left: 0, width: 200, top: 0, height: 200 },
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

const evt1 = {
  ...eventDetailFixture,
  event: { ...eventDetailFixture.event, startDate: 1_700_000_000_000 },
  activities: [
    {
      ...eventDetailFixture.activities[0],
      startDate: 1_700_000_000_000,
    },
  ],
};

const evt2 = {
  ...eventDetailEvt2Fixture,
  event: { ...eventDetailEvt2Fixture.event, startDate: 1_700_000_000_000 },
  activities: [
    {
      ...eventDetailEvt2Fixture.activities[0],
      startDate: 1_700_000_000_000,
    },
  ],
};

const heartRateStream1 = {
  type: 'Heart Rate',
  data: [
    { time: 1_700_000_000_000, value: 100 },
    { time: 1_700_000_001_000, value: 110 },
    { time: 1_700_000_002_000, value: 120 },
  ],
};

const heartRateStream2 = {
  type: 'Heart Rate',
  data: [
    { time: 1_700_000_000_000, value: 102 },
    { time: 1_700_000_001_000, value: 112 },
    { time: 1_700_000_002_000, value: 122 },
  ],
};

const streamsByEventId = {
  'evt-1': [heartRateStream1],
  'evt-2': [heartRateStream2],
};

const selectedActivities = { 'evt-1': 'act-1', 'evt-2': 'act-2' };
const eventColors = ['#ef4444', '#3b82f6'];

describe('StreamAnalysisSection', () => {
  it('shows "No common streams available" when streamsByEventId is empty', () => {
    render(StreamAnalysisSection, {
      props: {
        events: [evt1, evt2],
        streamsByEventId: {},
        selectedActivities,
        referenceActivityId: 'act-1',
        eventColors,
      },
    });
    expect(screen.getByText(/No common streams available/)).toBeInTheDocument();
  });

  it('renders stream type selector when common streams exist', () => {
    render(StreamAnalysisSection, {
      props: {
        events: [evt1, evt2],
        streamsByEventId,
        selectedActivities,
        referenceActivityId: 'act-1',
        eventColors,
      },
    });
    expect(screen.getByText('Heart Rate')).toBeInTheDocument();
  });

  it('renders analysis card with device names', () => {
    render(StreamAnalysisSection, {
      props: {
        events: [evt1, evt2],
        streamsByEventId,
        selectedActivities,
        referenceActivityId: 'act-1',
        eventColors,
      },
    });
    // The heading contains both device names in format "Ref vs Sec (stream)"
    const heading = screen.getByRole('heading', { level: 3 });
    expect(heading.textContent).toMatch(/Garmin Forerunner 945/);
    expect(heading.textContent).toMatch(/Wahoo Elemnt/);
  });

  it('renders stats row with Pearson r and other metrics', () => {
    render(StreamAnalysisSection, {
      props: {
        events: [evt1, evt2],
        streamsByEventId,
        selectedActivities,
        referenceActivityId: 'act-1',
        eventColors,
      },
    });
    expect(screen.getByText('Pearson r')).toBeInTheDocument();
    expect(screen.getByText('R²')).toBeInTheDocument();
    expect(screen.getByText('Mean diff')).toBeInTheDocument();
    expect(screen.getByText(/Max \|diff\|/)).toBeInTheDocument();
    expect(screen.getByText('Points (n)')).toBeInTheDocument();
  });

  it('uses first event as reference when referenceActivityId is null', () => {
    render(StreamAnalysisSection, {
      props: {
        events: [evt1, evt2],
        streamsByEventId,
        selectedActivities,
        referenceActivityId: null,
        eventColors,
      },
    });
    // Should still render analysis (defaults to first event)
    expect(screen.getByText('Heart Rate')).toBeInTheDocument();
  });

  it('allows selecting a different stream type', async () => {
    const speedStream1 = { type: 'Speed', data: [{ time: 1_700_000_000_000, value: 3.5 }] };
    const speedStream2 = { type: 'Speed', data: [{ time: 1_700_000_000_000, value: 3.6 }] };
    const streams = {
      'evt-1': [heartRateStream1, speedStream1],
      'evt-2': [heartRateStream2, speedStream2],
    };
    render(StreamAnalysisSection, {
      props: {
        events: [evt1, evt2],
        streamsByEventId: streams,
        selectedActivities,
        referenceActivityId: 'act-1',
        eventColors,
      },
    });
    const speedBtn = screen.getByText('Speed');
    expect(speedBtn).toBeInTheDocument();
    await fireEvent.click(speedBtn);
    // Speed is now selected (button should change style) - just verify no crash
    expect(screen.getByText('Speed')).toBeInTheDocument();
  });

  it('auto-selects Heart Rate stream by default when available', () => {
    const speedStream1 = { type: 'Speed', data: [{ time: 1_700_000_000_000, value: 3.5 }] };
    const speedStream2 = { type: 'Speed', data: [{ time: 1_700_000_000_000, value: 3.6 }] };
    const streams = {
      'evt-1': [heartRateStream1, speedStream1],
      'evt-2': [heartRateStream2, speedStream2],
    };
    render(StreamAnalysisSection, {
      props: {
        events: [evt1, evt2],
        streamsByEventId: streams,
        selectedActivities,
        referenceActivityId: 'act-1',
        eventColors,
      },
    });
    const hrBtn = screen.getByText('Heart Rate').closest('button');
    expect(hrBtn).toHaveAttribute('style', expect.stringMatching(/background-color/));
    const speedBtn = screen.getByText('Speed').closest('button');
    expect(speedBtn).not.toHaveAttribute('style', expect.stringMatching(/background-color/));
  });

  it('falls back to first available stream when Heart Rate is not present', () => {
    const speedStream1 = { type: 'Speed', data: [{ time: 1_700_000_000_000, value: 3.5 }] };
    const speedStream2 = { type: 'Speed', data: [{ time: 1_700_000_000_000, value: 3.6 }] };
    const streams = {
      'evt-1': [speedStream1],
      'evt-2': [speedStream2],
    };
    render(StreamAnalysisSection, {
      props: {
        events: [evt1, evt2],
        streamsByEventId: streams,
        selectedActivities,
        referenceActivityId: 'act-1',
        eventColors,
      },
    });
    const speedBtn = screen.getByText('Speed').closest('button');
    expect(speedBtn).toHaveAttribute('style', expect.stringMatching(/background-color/));
  });

  it('correlation badge displays the r value prominently', () => {
    render(StreamAnalysisSection, {
      props: {
        events: [evt1, evt2],
        streamsByEventId,
        selectedActivities,
        referenceActivityId: 'act-1',
        eventColors,
      },
    });
    const boldR = document.querySelector('.font-bold.font-mono');
    expect(boldR?.textContent).toBe('1.000');
  });

  it('correlation badge displays the rating label', () => {
    render(StreamAnalysisSection, {
      props: {
        events: [evt1, evt2],
        streamsByEventId,
        selectedActivities,
        referenceActivityId: 'act-1',
        eventColors,
      },
    });
    expect(screen.getByText('Excellent')).toBeInTheDocument();
  });
});
