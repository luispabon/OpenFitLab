import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';
import DashboardSingleDeleteFlow from '../DashboardSingleDeleteFlow.svelte';

const mockGetComparisonsByEventIds = vi.fn();
const mockDeleteEvent = vi.fn();

vi.mock('../../../api/comparisons', () => ({
  getComparisonsByEventIds: (...args: unknown[]) => mockGetComparisonsByEventIds(...args),
}));

describe('DashboardSingleDeleteFlow', () => {
  const defaultProps = {
    eventIdToDelete: null as string | null,
    deleteEvent: mockDeleteEvent,
    onDone: vi.fn(),
    onClosed: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetComparisonsByEventIds.mockResolvedValue([]);
  });

  it('shows no dialog when eventIdToDelete is null', () => {
    render(DashboardSingleDeleteFlow, { props: defaultProps });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows dialog and fetches comparisons when eventIdToDelete is set', async () => {
    render(DashboardSingleDeleteFlow, {
      props: { ...defaultProps, eventIdToDelete: 'evt-1' },
    });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(mockGetComparisonsByEventIds).toHaveBeenCalledWith(['evt-1']);
  });

  it('shows warning when event has linked comparisons', async () => {
    mockGetComparisonsByEventIds.mockResolvedValue([
      { id: 'c1', name: 'Morning vs Evening', createdAt: 123 },
      { id: 'c2', name: 'Weekly Compare', createdAt: 456 },
    ]);
    render(DashboardSingleDeleteFlow, {
      props: { ...defaultProps, eventIdToDelete: 'evt-1' },
    });
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'This will also permanently delete 2 comparisons: Morning vs Evening, Weekly Compare.'
      );
    });
  });

  it('does not show warning when no comparisons are linked', async () => {
    mockGetComparisonsByEventIds.mockResolvedValue([]);
    render(DashboardSingleDeleteFlow, {
      props: { ...defaultProps, eventIdToDelete: 'evt-1' },
    });
    await waitFor(() => {
      expect(mockGetComparisonsByEventIds).toHaveBeenCalled();
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
