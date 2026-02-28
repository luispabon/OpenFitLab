import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/svelte';
import Comparisons from '../comparisons.svelte';
import { comparisonFixture } from '../../test/fixtures/comparisons';

const mockGetComparisons = vi.fn();
const mockDeleteComparison = vi.fn();
const mockPush = vi.fn();

vi.mock('../../lib/api', () => ({
  getComparisons: (...args: unknown[]) => mockGetComparisons(...args),
  deleteComparison: (...args: unknown[]) => mockDeleteComparison(...args),
}));

vi.mock('svelte-spa-router', () => ({
  push: (...args: unknown[]) => mockPush(...args),
}));

describe('Comparisons', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state while fetching', async () => {
    mockGetComparisons.mockReturnValue(new Promise(() => {}));
    render(Comparisons);
    await waitFor(() => {
      const spinner = document.querySelector('svg.animate-spin');
      expect(spinner).toBeInTheDocument();
    });
  });

  it('shows error when getComparisons fails', async () => {
    mockGetComparisons.mockRejectedValue(new Error('Network error'));
    render(Comparisons);
    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('shows empty state when no comparisons', async () => {
    mockGetComparisons.mockResolvedValue([]);
    render(Comparisons);
    await waitFor(() => {
      expect(screen.getByText('No saved comparisons yet.')).toBeInTheDocument();
      expect(screen.getByText(/Create a comparison from the dashboard/)).toBeInTheDocument();
    });
  });

  it('shows table with comparison name, event count and created date', async () => {
    mockGetComparisons.mockResolvedValue([comparisonFixture]);
    render(Comparisons);
    await waitFor(() => {
      expect(screen.getByText('Run vs Ride')).toBeInTheDocument();
    });
    expect(screen.getByText('2 events')).toBeInTheDocument();
    // formatDate(1700000000000) -> "Nov 14, 2023" (locale en-US)
    expect(screen.getByText(/Nov 14, 2023/)).toBeInTheDocument();
  });

  it('navigates to compare view when row is clicked', async () => {
    mockGetComparisons.mockResolvedValue([comparisonFixture]);
    render(Comparisons);
    await waitFor(() => {
      expect(screen.getByText('Run vs Ride')).toBeInTheDocument();
    });
    await fireEvent.click(screen.getByText('Run vs Ride'));
    expect(mockPush).toHaveBeenCalledWith('/compare/cmp-1');
  });

  it('navigates to compare view when View button is clicked', async () => {
    mockGetComparisons.mockResolvedValue([comparisonFixture]);
    render(Comparisons);
    await waitFor(() => {
      expect(screen.getByText('View')).toBeInTheDocument();
    });
    await fireEvent.click(screen.getByRole('button', { name: 'View' }));
    expect(mockPush).toHaveBeenCalledWith('/compare/cmp-1');
  });

  it('opens delete dialog when Delete is clicked, then closes on Cancel', async () => {
    mockGetComparisons.mockResolvedValue([comparisonFixture]);
    render(Comparisons);
    await waitFor(() => {
      expect(screen.getByText('Delete')).toBeInTheDocument();
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Delete Comparison?')).toBeInTheDocument();
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('deletes comparison and reloads list when dialog Confirm is clicked', async () => {
    mockGetComparisons.mockResolvedValueOnce([comparisonFixture]).mockResolvedValueOnce([]);
    mockDeleteComparison.mockResolvedValue(undefined);
    render(Comparisons);
    await waitFor(() => {
      expect(screen.getByText('Run vs Ride')).toBeInTheDocument();
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
    const dialog = screen.getByRole('dialog');
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => {
      expect(mockDeleteComparison).toHaveBeenCalledWith('cmp-1');
    });
    await waitFor(() => {
      expect(mockGetComparisons).toHaveBeenCalledTimes(2);
      expect(screen.getByText('No saved comparisons yet.')).toBeInTheDocument();
    });
  });

  it('shows error when delete fails', async () => {
    mockGetComparisons.mockResolvedValue([comparisonFixture]);
    mockDeleteComparison.mockRejectedValue(new Error('Delete failed'));
    render(Comparisons);
    await waitFor(() => {
      expect(screen.getByText('Run vs Ride')).toBeInTheDocument();
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
    const dialog = screen.getByRole('dialog');
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => {
      expect(screen.getByText('Delete failed')).toBeInTheDocument();
    });
  });

  it('shows 1 event for single-event comparison', async () => {
    const single = { ...comparisonFixture, id: 'cmp-2', eventIds: ['evt-1'] };
    mockGetComparisons.mockResolvedValue([single]);
    render(Comparisons);
    await waitFor(() => {
      expect(screen.getByText('1 event')).toBeInTheDocument();
    });
  });
});
