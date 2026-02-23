import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';
import EventDetail from '../event-detail.svelte';
import { eventDetailFixture } from '../../test/fixtures/event-detail';

const mockGetEvent = vi.fn();

vi.mock('../../lib/api', () => ({
  getEvent: (...args: unknown[]) => mockGetEvent(...args),
  getStreams: vi.fn(() => Promise.resolve([])),
  getActivityTypes: vi.fn(() => Promise.resolve([])),
  getDevices: vi.fn(() => Promise.resolve([])),
  updateActivity: vi.fn(),
}));

vi.mock('svelte-spa-router', () => ({
  push: vi.fn(() => Promise.resolve()),
}));

describe('EventDetail', () => {
  beforeEach(() => {
    mockGetEvent.mockReset();
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
});
