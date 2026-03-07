import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/svelte';
import CompareCandidatesFlow from '../CompareCandidatesFlow.svelte';
import { activityRowsFixture } from '../../../../test/fixtures/activity-rows';
import type { EventSummary } from '../../../types/event';

const mockGetComparisonCandidates = vi.fn();

vi.mock('../../../api', () => ({
  getComparisonCandidates: (...args: unknown[]) => mockGetComparisonCandidates(...args),
}));

const candidateA: EventSummary = {
  id: 'evt-2',
  name: 'Evening Run',
  startDate: 1700010000000,
  endDate: 1700013600000,
  stats: {},
  activities: [
    {
      id: 'act-2',
      eventID: 'evt-2',
      name: 'Evening Run',
      type: 'running',
      deviceName: 'Wahoo Elemnt',
      startDate: 1700010000000,
      stats: {},
    },
  ],
};

const candidateB: EventSummary = {
  id: 'evt-3',
  name: 'Night Ride',
  startDate: 1700020000000,
  endDate: 1700023600000,
  stats: {},
  activities: [
    {
      id: 'act-3',
      eventID: 'evt-3',
      name: 'Night Ride',
      type: 'cycling',
      deviceName: 'Garmin',
      startDate: 1700020000000,
      stats: {},
    },
  ],
};

describe('CompareCandidatesFlow', () => {
  const mockOnCompare = vi.fn();
  const mockOnError = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetComparisonCandidates.mockResolvedValue([]);
  });

  it('shows no dialog when no event is opened', () => {
    render(CompareCandidatesFlow, {
      props: {
        activityRows: activityRowsFixture,
        onCompare: mockOnCompare,
        onError: mockOnError,
      },
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('calls getComparisonCandidates and opens modal when openForEvent is called', async () => {
    mockGetComparisonCandidates.mockResolvedValue([candidateA, candidateB]);
    const { component } = render(CompareCandidatesFlow, {
      props: {
        activityRows: activityRowsFixture,
        onCompare: mockOnCompare,
        onError: mockOnError,
      },
    });

    component.openForEvent('evt-1');

    expect(mockGetComparisonCandidates).toHaveBeenCalledWith('evt-1', {
      sameFolderOnly: true,
    });
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  it('shows loading state while fetching candidates', async () => {
    let resolvePromise: (value: EventSummary[]) => void;
    mockGetComparisonCandidates.mockImplementation(
      () =>
        new Promise<EventSummary[]>((resolve) => {
          resolvePromise = resolve;
        })
    );
    const { component } = render(CompareCandidatesFlow, {
      props: {
        activityRows: activityRowsFixture,
        onCompare: mockOnCompare,
        onError: mockOnError,
      },
    });

    component.openForEvent('evt-1');

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
    expect(screen.getByRole('dialog').querySelector('.animate-spin')).toBeInTheDocument();

    resolvePromise!([candidateA]);
    await waitFor(() => {
      expect(
        screen.getByText(/Select events that overlap in time with this event to compare/)
      ).toBeInTheDocument();
    });
  });

  it('shows candidate list after candidates load', async () => {
    mockGetComparisonCandidates.mockResolvedValue([candidateA, candidateB]);
    const { component } = render(CompareCandidatesFlow, {
      props: {
        activityRows: activityRowsFixture,
        onCompare: mockOnCompare,
        onError: mockOnError,
      },
    });

    component.openForEvent('evt-1');

    await waitFor(() => {
      expect(screen.getByText('Evening Run')).toBeInTheDocument();
    });
    expect(screen.getByText('Night Ride')).toBeInTheDocument();
  });

  it('calls onCompare with [sourceEventId, ...selectedIds] when user selects one and clicks Compare', async () => {
    mockGetComparisonCandidates.mockResolvedValue([candidateA, candidateB]);
    const { component } = render(CompareCandidatesFlow, {
      props: {
        activityRows: activityRowsFixture,
        onCompare: mockOnCompare,
        onError: mockOnError,
      },
    });

    component.openForEvent('evt-1');

    await waitFor(() => {
      expect(screen.getByText('Evening Run')).toBeInTheDocument();
    });

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.change(checkboxes[0], { target: { checked: true } });

    const compareBtn = await screen.findByRole('button', { name: /Compare \(2 event/ });
    fireEvent.click(compareBtn);

    expect(mockOnCompare).toHaveBeenCalledWith(
      ['evt-1', 'evt-2'],
      null // suggestedFolderId (source event has no folderId in fixture)
    );
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('resets state when user cancels', async () => {
    mockGetComparisonCandidates.mockResolvedValue([candidateA]);
    const { component } = render(CompareCandidatesFlow, {
      props: {
        activityRows: activityRowsFixture,
        onCompare: mockOnCompare,
        onError: mockOnError,
      },
    });

    component.openForEvent('evt-1');
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(mockOnCompare).not.toHaveBeenCalled();
  });

  it('calls onError when getComparisonCandidates rejects', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockGetComparisonCandidates.mockRejectedValue(new Error('Network error'));
    const { component } = render(CompareCandidatesFlow, {
      props: {
        activityRows: activityRowsFixture,
        onCompare: mockOnCompare,
        onError: mockOnError,
      },
    });

    component.openForEvent('evt-1');

    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith('Network error');
    });
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
    expect(screen.getByText('No overlapping events found for comparison.')).toBeInTheDocument();
    consoleError.mockRestore();
  });
});
