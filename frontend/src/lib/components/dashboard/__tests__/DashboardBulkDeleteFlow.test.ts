import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/svelte';
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

  it('handles getComparisonsByEventIds rejection without crashing', async () => {
    mockGetComparisonsByEventIds.mockRejectedValue(new Error('Network error'));
    render(DashboardBulkDeleteFlow, {
      props: { ...defaultProps, eventIdsToDelete: ['evt-1', 'evt-2'] },
    });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await waitFor(() => {
      expect(mockGetComparisonsByEventIds).toHaveBeenCalled();
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('calls onDone and onClosed after bulk confirm with mixed success/failure', async () => {
    const onDone = vi.fn();
    const onClosed = vi.fn();
    mockDeleteEvent.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    render(DashboardBulkDeleteFlow, {
      props: {
        ...defaultProps,
        eventIdsToDelete: ['evt-1', 'evt-2'],
        onDone,
        onClosed,
      },
    });
    await waitFor(() => {
      expect(mockGetComparisonsByEventIds).toHaveBeenCalled();
    });
    const confirmBtn = screen.getByRole('button', { name: 'Delete 2 Events' });
    await fireEvent.click(confirmBtn);
    await waitFor(() => {
      expect(mockDeleteEvent).toHaveBeenCalledWith('evt-1');
      expect(mockDeleteEvent).toHaveBeenCalledWith('evt-2');
    });
    await waitFor(() => {
      expect(onDone).toHaveBeenCalledWith(1, 1);
      expect(onClosed).toHaveBeenCalled();
    });
  });

  it('calls onDone with failed count and onClosed when deleteEvent rejects', async () => {
    const onDone = vi.fn();
    const onClosed = vi.fn();
    mockDeleteEvent.mockRejectedValueOnce(new Error('Network error')).mockResolvedValueOnce(true);
    render(DashboardBulkDeleteFlow, {
      props: {
        ...defaultProps,
        eventIdsToDelete: ['evt-1', 'evt-2'],
        onDone,
        onClosed,
      },
    });
    await waitFor(() => {
      expect(mockGetComparisonsByEventIds).toHaveBeenCalled();
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Delete 2 Events' }));
    await waitFor(() => {
      expect(mockDeleteEvent).toHaveBeenCalledWith('evt-1');
      expect(mockDeleteEvent).toHaveBeenCalledWith('evt-2');
    });
    await waitFor(() => {
      expect(onDone).toHaveBeenCalledWith(1, 1);
      expect(onClosed).toHaveBeenCalled();
    });
  });

  it('shows progress bar while bulk deleting', async () => {
    let resolveFirst!: (value: boolean) => void;
    mockDeleteEvent.mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          resolveFirst = resolve;
        })
    );
    render(DashboardBulkDeleteFlow, {
      props: { ...defaultProps, eventIdsToDelete: ['evt-1', 'evt-2'] },
    });
    await waitFor(() => {
      expect(mockGetComparisonsByEventIds).toHaveBeenCalled();
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Delete 2 Events' }));
    await waitFor(() => {
      expect(
        screen.getByRole('progressbar', { name: 'Deleting event progress' })
      ).toBeInTheDocument();
    });
    resolveFirst(true);
    mockDeleteEvent.mockResolvedValue(true);
    await waitFor(() => {
      expect(
        screen.queryByRole('progressbar', { name: 'Deleting event progress' })
      ).not.toBeInTheDocument();
    });
  });
});
