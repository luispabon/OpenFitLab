import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/svelte';
import EventDetail from '../event-detail.svelte';
import { eventDetailFixture, activityFixture } from '../../test/fixtures/event-detail';
import { streamsNoLocationFixture, streamsLatLngFixture } from '../../test/fixtures/streams';
import type { EventDetail as EventDetailType } from '../../lib/types';
import type { ComparisonSummary } from '../../lib/api/comparisons';

const mockGetEvent = vi.fn();
const mockGetStreams = vi.fn();
const mockGetActivityTypes = vi.fn();
const mockGetDevices = vi.fn();
const mockUpdateActivity = vi.fn();
const mockGetComparisonsByEventIds = vi.fn();
const mockPush = vi.fn();

vi.mock('../../lib/api', () => ({
  getEvent: (...args: unknown[]) => mockGetEvent(...args),
  getStreams: (...args: unknown[]) => mockGetStreams(...args),
  getActivityTypes: (...args: unknown[]) => mockGetActivityTypes(...args),
  getDevices: (...args: unknown[]) => mockGetDevices(...args),
  updateActivity: (...args: unknown[]) => mockUpdateActivity(...args),
}));

vi.mock('../../lib/api/comparisons', () => ({
  getComparisonsByEventIds: (...args: unknown[]) => mockGetComparisonsByEventIds(...args),
}));

vi.mock('svelte-spa-router', () => ({
  push: (...args: unknown[]) => mockPush(...args),
}));

vi.mock('../../lib/components/RouteMap.svelte', async () => {
  const mod = await import('./RouteMapStub.svelte');
  return { default: mod.default };
});

vi.mock('../../lib/components/workouts/CompareCandidatesFlow.svelte', async () => {
  const mod = await import('./CompareCandidatesFlowStub.svelte');
  return { default: mod.default };
});

describe('EventDetail', () => {
  beforeEach(() => {
    mockGetEvent.mockReset();
    mockGetStreams.mockReset().mockResolvedValue([]);
    mockGetActivityTypes.mockResolvedValue(['running', 'cycling']);
    mockGetDevices.mockResolvedValue(['Garmin Forerunner 945', 'Wahoo Elemnt']);
    mockUpdateActivity.mockReset();
    mockGetComparisonsByEventIds.mockReset().mockResolvedValue([]);
    mockPush.mockReset();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = vi.fn();
        disconnect = vi.fn();
        unobserve = vi.fn();
        constructor(_callback: () => void) {}
      }
    );
  });

  it('reads params.id and fetches event', async () => {
    mockGetEvent.mockResolvedValue(eventDetailFixture);
    render(EventDetail, { props: { params: { id: 'evt-1' } } });
    await waitFor(() => {
      expect(mockGetEvent).toHaveBeenCalledWith(
        'evt-1',
        expect.objectContaining({ signal: expect.anything() })
      );
    });
  });

  it('shows loading state while fetching', async () => {
    mockGetEvent.mockReturnValue(new Promise(() => {}));
    render(EventDetail, { props: { params: { id: 'evt-1' } } });
    await waitFor(() => {
      const spinner = document.querySelector('svg.animate-spin');
      expect(spinner).toBeInTheDocument();
    });
  });

  it('shows error on 404', async () => {
    mockGetEvent.mockRejectedValue(new Error('Event not found'));
    render(EventDetail, { props: { params: { id: 'evt-1' } } });
    await waitFor(() => {
      expect(screen.getByText('Event not found')).toBeInTheDocument();
    });
  });

  it('renders event name and key metrics when loaded', async () => {
    mockGetEvent.mockResolvedValue(eventDetailFixture);
    render(EventDetail, { props: { params: { id: 'evt-1' } } });
    await waitFor(() => {
      expect(screen.getByText('Morning Run')).toBeInTheDocument();
    });
    expect(screen.getByText('running')).toBeInTheDocument();
    expect(screen.getByText(/1:00:00/)).toBeInTheDocument();
  });

  it('Back to Workouts button calls push("/") when no back param', async () => {
    mockGetEvent.mockResolvedValue(eventDetailFixture);
    render(EventDetail, { props: { params: { id: 'evt-1' } } });
    await waitFor(() => {
      expect(screen.getByText('Morning Run')).toBeInTheDocument();
    });
    await fireEvent.click(screen.getByRole('button', { name: '← Back to Workouts' }));
    expect(mockPush).toHaveBeenCalledWith('/');
  });

  it('Back to Workouts button restores folder when back param is set via query prop', async () => {
    mockGetEvent.mockResolvedValue(eventDetailFixture);
    render(EventDetail, { props: { params: { id: 'evt-1' }, query: { back: 'folder-123' } } });
    await waitFor(() => {
      expect(screen.getByText('Morning Run')).toBeInTheDocument();
    });
    await fireEvent.click(screen.getByRole('button', { name: '← Back to Workouts' }));
    expect(mockPush).toHaveBeenCalledWith('#/?folder=folder-123');
  });

  it('Back to Workouts button restores folder when back param is in window.location.hash', async () => {
    vi.stubGlobal('location', { hash: '#/event/evt-1?back=folder-123' });
    mockGetEvent.mockResolvedValue(eventDetailFixture);
    render(EventDetail, { props: { params: { id: 'evt-1' } } });
    await waitFor(() => {
      expect(screen.getByText('Morning Run')).toBeInTheDocument();
    });
    await fireEvent.click(screen.getByRole('button', { name: '← Back to Workouts' }));
    expect(mockPush).toHaveBeenCalledWith('#/?folder=folder-123');
    vi.unstubAllGlobals();
  });

  it('when id is missing shows Event not found', () => {
    render(EventDetail, { props: { params: {} } });
    expect(mockGetEvent).not.toHaveBeenCalled();
    expect(screen.getByText('Event not found.')).toBeInTheDocument();
  });

  it('opens activity type editor and cancel closes it', async () => {
    mockGetEvent.mockResolvedValue(eventDetailFixture);
    render(EventDetail, { props: { params: { id: 'evt-1' } } });
    await waitFor(() => {
      expect(screen.getByText('running')).toBeInTheDocument();
    });
    const activityTypeButton = screen.getByRole('button', { name: /running/ });
    await fireEvent.click(activityTypeButton);
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Activity type…')).toBeInTheDocument();
    });
    await fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Activity type…')).not.toBeInTheDocument();
    });
  });

  it('commit activity type calls updateActivity and updates UI', async () => {
    mockGetEvent.mockResolvedValue(eventDetailFixture);
    mockUpdateActivity.mockResolvedValue({ ...activityFixture, type: 'cycling' });
    render(EventDetail, { props: { params: { id: 'evt-1' } } });
    await waitFor(() => {
      expect(screen.getByText('running')).toBeInTheDocument();
    });
    await fireEvent.click(screen.getByRole('button', { name: /running/ }));
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Activity type…')).toBeInTheDocument();
    });
    const combobox = screen.getByPlaceholderText('Activity type…');
    await fireEvent.input(combobox, { target: { value: 'cy' } });
    await waitFor(() => {
      expect(screen.getByText('cycling', { selector: '[role="option"]' })).toBeInTheDocument();
    });
    await fireEvent.click(screen.getByText('cycling', { selector: '[role="option"]' }));
    await waitFor(() => {
      expect(mockUpdateActivity).toHaveBeenCalledWith('evt-1', 'act-1', { type: 'cycling' });
    });
    await waitFor(() => {
      expect(screen.getByText('cycling')).toBeInTheDocument();
    });
  });

  it('opens device editor and cancel closes it', async () => {
    mockGetEvent.mockResolvedValue(eventDetailFixture);
    render(EventDetail, { props: { params: { id: 'evt-1' } } });
    await waitFor(() => {
      expect(screen.getByText('Garmin Forerunner 945')).toBeInTheDocument();
    });
    const deviceButton = screen.getByRole('button', { name: 'Garmin Forerunner 945' });
    await fireEvent.click(deviceButton);
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Device…')).toBeInTheDocument();
    });
    await fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Device…')).not.toBeInTheDocument();
    });
  });

  it('commit device calls updateActivity and updates UI', async () => {
    mockGetEvent.mockResolvedValue(eventDetailFixture);
    mockUpdateActivity.mockResolvedValue({
      ...activityFixture,
      deviceName: 'Wahoo Elemnt',
    });
    render(EventDetail, { props: { params: { id: 'evt-1' } } });
    await waitFor(() => {
      expect(screen.getByText('Garmin Forerunner 945')).toBeInTheDocument();
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Garmin Forerunner 945' }));
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Device…')).toBeInTheDocument();
    });
    const combobox = screen.getByPlaceholderText('Device…');
    await fireEvent.input(combobox, { target: { value: 'Wahoo' } });
    await waitFor(() => {
      expect(screen.getByText('Wahoo Elemnt', { selector: '[role="option"]' })).toBeInTheDocument();
    });
    await fireEvent.click(screen.getByText('Wahoo Elemnt', { selector: '[role="option"]' }));
    await waitFor(() => {
      expect(mockUpdateActivity).toHaveBeenCalledWith('evt-1', 'act-1', {
        deviceName: 'Wahoo Elemnt',
      });
    });
    await waitFor(() => {
      expect(screen.getByText('Wahoo Elemnt')).toBeInTheDocument();
    });
  });

  it('shows streams error when getStreams fails', async () => {
    mockGetEvent.mockResolvedValue(eventDetailFixture);
    mockGetStreams.mockRejectedValue(new Error('Failed to load streams'));
    render(EventDetail, { props: { params: { id: 'evt-1' } } });
    await waitFor(() => {
      expect(screen.getByText('Failed to load streams')).toBeInTheDocument();
    });
    expect(screen.getByText(/Charts will not be available/)).toBeInTheDocument();
  });

  it('stream toggle is callable when streams loaded', async () => {
    mockGetEvent.mockResolvedValue(eventDetailFixture);
    mockGetStreams.mockResolvedValue(streamsNoLocationFixture);
    render(EventDetail, { props: { params: { id: 'evt-1' } } });
    await waitFor(() => {
      const hrButton = screen.queryByRole('button', { name: /Heart Rate/i });
      expect(hrButton).toBeInTheDocument();
    });
    const hrButton = screen.getByRole('button', { name: /Heart Rate/i });
    await fireEvent.click(hrButton);
  });

  it('uses default params when params is undefined', async () => {
    render(EventDetail, { props: {} });
    expect(mockGetEvent).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '← Back to Workouts' })).toBeInTheDocument();
    });
  });

  it('derives mainActivityType from event.stats Activity Types array when activities have no type', async () => {
    const noTypeActivity = { ...activityFixture, type: undefined };
    const eventWithTypesInStats = {
      event: {
        ...eventDetailFixture.event,
        stats: {
          ...eventDetailFixture.event.stats,
          'Activity Types': ['cycling', 'running'],
        },
      },
      activities: [noTypeActivity],
    } satisfies EventDetailType;
    mockGetEvent.mockResolvedValue(eventWithTypesInStats);
    mockGetStreams.mockResolvedValue([]);
    render(EventDetail, { props: { params: { id: 'evt-1' } } });
    await waitFor(() => {
      expect(screen.getByText('cycling')).toBeInTheDocument();
    });
  });

  it('derives mainActivityType from event.stats Activity Types string when activities have no type', async () => {
    const noTypeActivity = { ...activityFixture, type: undefined };
    const eventWithStringType = {
      event: {
        ...eventDetailFixture.event,
        stats: {
          ...eventDetailFixture.event.stats,
          'Activity Types': 'hiking',
        },
      },
      activities: [noTypeActivity],
    } satisfies EventDetailType;
    mockGetEvent.mockResolvedValue(eventWithStringType);
    mockGetStreams.mockResolvedValue([]);
    render(EventDetail, { props: { params: { id: 'evt-1' } } });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /hiking/ })).toBeInTheDocument();
    });
  });

  it('shows fallback when no activities and no Activity Types in stats', async () => {
    const eventNoActivities = {
      event: eventDetailFixture.event,
      activities: [],
    } satisfies EventDetailType;
    mockGetEvent.mockResolvedValue(eventNoActivities);
    mockGetStreams.mockResolvedValue([]);
    render(EventDetail, { props: { params: { id: 'evt-1' } } });
    await waitFor(() => {
      expect(screen.getByText('Morning Run')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: '← Back to Workouts' })).toBeInTheDocument();
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  it('shows saveError when commit activity type fails', async () => {
    mockGetEvent.mockResolvedValue(eventDetailFixture);
    mockUpdateActivity.mockRejectedValue(new Error('Network error'));
    render(EventDetail, { props: { params: { id: 'evt-1' } } });
    await waitFor(() => {
      expect(screen.getByText('running')).toBeInTheDocument();
    });
    await fireEvent.click(screen.getByRole('button', { name: /running/ }));
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Activity type…')).toBeInTheDocument();
    });
    const combobox = screen.getByPlaceholderText('Activity type…');
    await fireEvent.input(combobox, { target: { value: 'cy' } });
    await waitFor(() => {
      expect(screen.getByText('cycling', { selector: '[role="option"]' })).toBeInTheDocument();
    });
    await fireEvent.click(screen.getByText('cycling', { selector: '[role="option"]' }));
    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('shows saveError when commit device fails', async () => {
    mockGetEvent.mockResolvedValue(eventDetailFixture);
    mockUpdateActivity.mockRejectedValue(new Error('Server error'));
    render(EventDetail, { props: { params: { id: 'evt-1' } } });
    await waitFor(() => {
      expect(screen.getByText('Garmin Forerunner 945')).toBeInTheDocument();
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Garmin Forerunner 945' }));
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Device…')).toBeInTheDocument();
    });
    const combobox = screen.getByPlaceholderText('Device…');
    await fireEvent.input(combobox, { target: { value: 'Wahoo' } });
    await waitFor(() => {
      expect(screen.getByText('Wahoo Elemnt', { selector: '[role="option"]' })).toBeInTheDocument();
    });
    await fireEvent.click(screen.getByText('Wahoo Elemnt', { selector: '[role="option"]' }));
    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeInTheDocument();
    });
  });

  it('renders RouteMap when streams have location data', async () => {
    mockGetEvent.mockResolvedValue(eventDetailFixture);
    mockGetStreams.mockResolvedValue(streamsLatLngFixture);
    render(EventDetail, { props: { params: { id: 'evt-1' } } });
    await waitFor(() => {
      expect(screen.getByText('Morning Run')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByTestId('route-map')).toBeInTheDocument();
    });
  });

  it('calls onViewModeStacked when Stacked is clicked in charts', async () => {
    mockGetEvent.mockResolvedValue(eventDetailFixture);
    mockGetStreams.mockResolvedValue(streamsNoLocationFixture);
    render(EventDetail, { props: { params: { id: 'evt-1' } } });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Heart Rate/i })).toBeInTheDocument();
    });
    const stackedButton = screen.getByRole('button', { name: 'Stacked' });
    await fireEvent.click(stackedButton);
    await fireEvent.click(screen.getByRole('button', { name: 'Overlay' }));
  });

  it('shows Event not found when getEvent returns event null', async () => {
    mockGetEvent.mockResolvedValue({
      event: null,
      activities: [],
    } as unknown as EventDetailType);
    render(EventDetail, { props: { params: { id: 'evt-1' } } });
    await waitFor(() => {
      expect(screen.getByText('Event not found.')).toBeInTheDocument();
    });
  });

  describe('Related comparisons section', () => {
    it('always renders the comparisons section header and Compare button', async () => {
      mockGetEvent.mockResolvedValue(eventDetailFixture);
      render(EventDetail, { props: { params: { id: 'evt-1' } } });
      await waitFor(() => {
        expect(screen.getByText('Morning Run')).toBeInTheDocument();
      });
      expect(screen.getByText(/In comparisons/)).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /Compare with another event/ })
      ).toBeInTheDocument();
    });

    it('shows "Not in any comparisons yet." when comparisons list is empty', async () => {
      mockGetEvent.mockResolvedValue(eventDetailFixture);
      mockGetComparisonsByEventIds.mockResolvedValue([]);
      render(EventDetail, { props: { params: { id: 'evt-1' } } });
      await waitFor(() => {
        expect(screen.getByText('Morning Run')).toBeInTheDocument();
      });
      await waitFor(() => {
        expect(screen.getByText('Not in any comparisons yet.')).toBeInTheDocument();
      });
    });

    it('shows comparisons loading state inside the section', async () => {
      mockGetEvent.mockResolvedValue(eventDetailFixture);
      mockGetComparisonsByEventIds.mockReturnValue(new Promise(() => {}));
      render(EventDetail, { props: { params: { id: 'evt-1' } } });
      await waitFor(() => {
        expect(screen.getByText('Morning Run')).toBeInTheDocument();
      });
      await waitFor(() => {
        expect(screen.getByText('Loading related comparisons...')).toBeInTheDocument();
      });
      expect(screen.getByText(/In comparisons/)).toBeInTheDocument();
    });

    it('shows comparisons error state inside the section', async () => {
      mockGetEvent.mockResolvedValue(eventDetailFixture);
      mockGetComparisonsByEventIds.mockRejectedValue(new Error('Failed to fetch comparisons'));
      render(EventDetail, { props: { params: { id: 'evt-1' } } });
      await waitFor(() => {
        expect(screen.getByText('Morning Run')).toBeInTheDocument();
      });
      await waitFor(() => {
        expect(screen.getByText('Failed to fetch comparisons')).toBeInTheDocument();
      });
      expect(screen.getByText(/In comparisons/)).toBeInTheDocument();
    });

    it('lists related comparisons when they exist', async () => {
      const comparisons: ComparisonSummary[] = [
        { id: 'cmp-1', name: 'Morning Run vs Interval Run' },
        { id: 'cmp-2', name: 'Easy Run vs Long Run' },
      ];
      mockGetEvent.mockResolvedValue(eventDetailFixture);
      mockGetComparisonsByEventIds.mockResolvedValue(comparisons);
      render(EventDetail, { props: { params: { id: 'evt-1' } } });
      await waitFor(() => {
        expect(screen.getByText('Morning Run vs Interval Run')).toBeInTheDocument();
      });
      expect(screen.getByText('Easy Run vs Long Run')).toBeInTheDocument();
      expect(screen.getByText('In comparisons (2)')).toBeInTheDocument();
    });

    it('clicking "Compare with another event" does not throw', async () => {
      mockGetEvent.mockResolvedValue(eventDetailFixture);
      render(EventDetail, { props: { params: { id: 'evt-1' } } });
      await waitFor(() => {
        expect(screen.getByText('Morning Run')).toBeInTheDocument();
      });
      const compareBtn = screen.getByRole('button', { name: /Compare with another event/ });
      await fireEvent.click(compareBtn);
    });
  });
});
