import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';
import DashboardBulkDeleteFlow from '../DashboardBulkDeleteFlow.svelte';

const mockGetComparisonsByEventIds = vi.fn();
const mockDeleteEvent = vi.fn();

vi.mock('../../../api/comparisons', () => ({
  getComparisonsByEventIds: (...args: unknown[]) => mockGetComparisonsByEventIds(...args),
}));

describe('DashboardBulkDeleteFlow', () => {
  const defaultProps = {
    eventIdsToDelete: [] as string[],
    deleteEvent: mockDeleteEvent,
    onDone: vi.fn(),
    onClosed: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetComparisonsByEventIds.mockResolvedValue([]);
  });

  it('shows no dialog when eventIdsToDelete is empty', () => {
    render(DashboardBulkDeleteFlow, { props: defaultProps });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows dialog and fetches comparisons when eventIdsToDelete has ids', async () => {
    render(DashboardBulkDeleteFlow, {
      props: { ...defaultProps, eventIdsToDelete: ['evt-1', 'evt-2'] },
    });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(mockGetComparisonsByEventIds).toHaveBeenCalledWith(['evt-1', 'evt-2']);
  });

  it('shows warning when any selected event has linked comparisons', async () => {
    mockGetComparisonsByEventIds.mockResolvedValue([
      { id: 'c1', name: 'Run Compare', createdAt: 123 },
    ]);
    render(DashboardBulkDeleteFlow, {
      props: { ...defaultProps, eventIdsToDelete: ['evt-1', 'evt-2'] },
    });
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'This will also permanently delete 1 comparison: Run Compare.'
      );
    });
  });

  it('does not show warning when no comparisons are linked', async () => {
    mockGetComparisonsByEventIds.mockResolvedValue([]);
    render(DashboardBulkDeleteFlow, {
      props: { ...defaultProps, eventIdsToDelete: ['evt-1'] },
    });
    await waitFor(() => {
      expect(mockGetComparisonsByEventIds).toHaveBeenCalled();
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
