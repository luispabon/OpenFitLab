import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/svelte';
import EventDetail from '../event-detail.svelte';
import { eventDetailFixture, activityFixture } from '../../test/fixtures/event-detail';
import { streamsNoLocationFixture } from '../../test/fixtures/streams';

const mockGetEvent = vi.fn();
const mockGetStreams = vi.fn();
const mockGetActivityTypes = vi.fn();
const mockGetDevices = vi.fn();
const mockUpdateActivity = vi.fn();
const mockPush = vi.fn();

vi.mock('../../lib/api', () => ({
  getEvent: (...args: unknown[]) => mockGetEvent(...args),
  getStreams: (...args: unknown[]) => mockGetStreams(...args),
  getActivityTypes: (...args: unknown[]) => mockGetActivityTypes(...args),
  getDevices: (...args: unknown[]) => mockGetDevices(...args),
  updateActivity: (...args: unknown[]) => mockUpdateActivity(...args),
}));

vi.mock('svelte-spa-router', () => ({
  push: (...args: unknown[]) => mockPush(...args),
}));

describe('EventDetail', () => {
  beforeEach(() => {
    mockGetEvent.mockReset();
    mockGetStreams.mockReset().mockResolvedValue([]);
    mockGetActivityTypes.mockResolvedValue(['running', 'cycling']);
    mockGetDevices.mockResolvedValue(['Garmin Forerunner 945', 'Wahoo Elemnt']);
    mockUpdateActivity.mockReset();
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
      expect(mockGetEvent).toHaveBeenCalledWith('evt-1');
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

  it('Back to Dashboard button calls push("/")', async () => {
    mockGetEvent.mockResolvedValue(eventDetailFixture);
    render(EventDetail, { props: { params: { id: 'evt-1' } } });
    await waitFor(() => {
      expect(screen.getByText('Morning Run')).toBeInTheDocument();
    });
    await fireEvent.click(screen.getByRole('button', { name: '← Back to Dashboard' }));
    expect(mockPush).toHaveBeenCalledWith('/');
  });

  it('when id is missing does not call getEvent and shows loading', async () => {
    render(EventDetail, { props: { params: {} } });
    expect(mockGetEvent).not.toHaveBeenCalled();
    await waitFor(() => {
      const spinner = document.querySelector('svg.animate-spin');
      expect(spinner).toBeInTheDocument();
    });
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
});
