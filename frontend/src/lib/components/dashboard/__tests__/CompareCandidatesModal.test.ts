import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import CompareCandidatesModal from '../CompareCandidatesModal.svelte';
import type { EventSummary } from '../../../types';
import { activityRowFixture } from '../../../../test/fixtures/activity-rows';
import { activityFixture } from '../../../../test/fixtures/event-detail';

function candidateEventSummary(overrides: Partial<EventSummary> & { id: string }): EventSummary {
  const firstActivity = overrides.activities?.[0];
  const defaultActivity = {
    ...activityFixture,
    id: `act-${overrides.id}`,
    eventID: overrides.id,
    name: overrides.name,
    startDate: overrides.startDate ?? 1700000000000,
    type: firstActivity?.type ?? 'running',
    deviceName: firstActivity?.deviceName ?? 'Device',
  };
  return {
    ...overrides,
    id: overrides.id,
    name: overrides.name ?? 'Event',
    startDate: overrides.startDate ?? 1700000000000,
    endDate: overrides.endDate,
    stats: overrides.stats ?? {},
    activities: overrides.activities ?? [defaultActivity],
  };
}

const defaultProps = {
  open: true,
  sourceEventRow: activityRowFixture,
  candidates: [] as EventSummary[],
  candidatesLoading: false,
  selectedCandidateIds: new Set<string>(),
  onToggleCandidate: vi.fn(),
  onCompare: vi.fn(),
  onCancel: vi.fn(),
};

describe('CompareCandidatesModal', () => {
  describe('visibility', () => {
    it('renders nothing when open is false', () => {
      render(CompareCandidatesModal, {
        props: { ...defaultProps, open: false },
      });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('renders dialog with aria-modal when open is true', () => {
      render(CompareCandidatesModal, { props: defaultProps });
      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveAttribute('aria-modal', 'true');
    });
  });

  describe('header', () => {
    it('shows title "Find Comparison Candidates"', () => {
      render(CompareCandidatesModal, { props: defaultProps });
      expect(screen.getByText('Find Comparison Candidates')).toBeInTheDocument();
    });

    it('shows source event activity type, device, name and date when sourceEventRow is set', () => {
      render(CompareCandidatesModal, { props: defaultProps });
      expect(screen.getByText('running')).toBeInTheDocument();
      expect(screen.getByText('Garmin Forerunner 945')).toBeInTheDocument();
      expect(screen.getByText('Morning Run')).toBeInTheDocument();
      // formatDateWithTime(1700000000000) produces a date like "Nov 14, 2023 at 22:13"
      expect(screen.getByText(/Nov 14, 2023/)).toBeInTheDocument();
    });

    it('shows close button with aria-label', () => {
      render(CompareCandidatesModal, { props: defaultProps });
      expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
    });

    it('renders header when sourceEventRow is null', () => {
      render(CompareCandidatesModal, {
        props: { ...defaultProps, sourceEventRow: null },
      });
      expect(screen.getByText('Find Comparison Candidates')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('shows loading spinner when candidatesLoading is true', () => {
      render(CompareCandidatesModal, {
        props: { ...defaultProps, candidatesLoading: true },
      });
      const dialog = screen.getByRole('dialog');
      expect(dialog.querySelector('svg')).toBeInTheDocument();
    });
  });

  describe('empty candidates', () => {
    it('shows "No overlapping events found for comparison." when not loading and candidates empty', () => {
      render(CompareCandidatesModal, { props: defaultProps });
      expect(screen.getByText('No overlapping events found for comparison.')).toBeInTheDocument();
    });
  });

  describe('candidate list', () => {
    const twoCandidates: EventSummary[] = [
      candidateEventSummary({ id: 'evt-2', name: 'Evening Run' }),
      candidateEventSummary({ id: 'evt-3', name: 'Afternoon Ride' }),
    ];

    it('shows helper text and list when candidates has items', () => {
      render(CompareCandidatesModal, {
        props: { ...defaultProps, candidates: twoCandidates },
      });
      expect(
        screen.getByText('Select events that overlap in time with this event to compare:')
      ).toBeInTheDocument();
      expect(screen.getByText('Evening Run')).toBeInTheDocument();
      expect(screen.getByText('Afternoon Ride')).toBeInTheDocument();
    });

    it('checkbox checked state reflects selectedCandidateIds', () => {
      render(CompareCandidatesModal, {
        props: {
          ...defaultProps,
          candidates: twoCandidates,
          selectedCandidateIds: new Set(['evt-2']),
        },
      });
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes).toHaveLength(2);
      expect(checkboxes[0]).toBeChecked();
      expect(checkboxes[1]).not.toBeChecked();
    });

    it('calls onToggleCandidate with event id when checkbox is changed', async () => {
      const onToggleCandidate = vi.fn();
      render(CompareCandidatesModal, {
        props: {
          ...defaultProps,
          candidates: twoCandidates,
          onToggleCandidate,
        },
      });
      const checkboxes = screen.getAllByRole('checkbox');
      await fireEvent.click(checkboxes[1]);
      expect(onToggleCandidate).toHaveBeenCalledTimes(1);
      expect(onToggleCandidate).toHaveBeenCalledWith('evt-3');
    });
  });

  describe('footer', () => {
    it('Cancel button is present and calls onCancel when clicked', async () => {
      const onCancel = vi.fn();
      render(CompareCandidatesModal, {
        props: { ...defaultProps, onCancel },
      });
      await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('Compare button is disabled when no candidate selected', () => {
      render(CompareCandidatesModal, {
        props: {
          ...defaultProps,
          candidates: [candidateEventSummary({ id: 'evt-2' })],
        },
      });
      const compareBtn = screen.getByRole('button', { name: /Compare \(1 event\)/ });
      expect(compareBtn).toBeDisabled();
    });

    it('Compare button shows count and is enabled when at least one selected', () => {
      render(CompareCandidatesModal, {
        props: {
          ...defaultProps,
          candidates: [
            candidateEventSummary({ id: 'evt-2' }),
            candidateEventSummary({ id: 'evt-3' }),
          ],
          selectedCandidateIds: new Set(['evt-2']),
        },
      });
      const compareBtn = screen.getByRole('button', { name: /Compare \(2 events\)/ });
      expect(compareBtn).not.toBeDisabled();
    });

    it('Compare button click calls onCompare when enabled', async () => {
      const onCompare = vi.fn();
      render(CompareCandidatesModal, {
        props: {
          ...defaultProps,
          candidates: [candidateEventSummary({ id: 'evt-2' })],
          selectedCandidateIds: new Set(['evt-2']),
          onCompare,
        },
      });
      await fireEvent.click(screen.getByRole('button', { name: /Compare \(2 events\)/ }));
      expect(onCompare).toHaveBeenCalledTimes(1);
    });
  });

  describe('Escape and backdrop', () => {
    it('calls onCancel when Escape is pressed', async () => {
      const onCancel = vi.fn();
      render(CompareCandidatesModal, {
        props: { ...defaultProps, onCancel },
      });
      const dialog = screen.getByRole('dialog');
      await fireEvent.keyDown(dialog, { key: 'Escape' });
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('calls onCancel when Escape is pressed from inside the content', async () => {
      const onCancel = vi.fn();
      render(CompareCandidatesModal, {
        props: { ...defaultProps, onCancel },
      });
      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      await fireEvent.keyDown(cancelButton, { key: 'Escape' });
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('calls onCancel when backdrop is clicked', async () => {
      const onCancel = vi.fn();
      render(CompareCandidatesModal, {
        props: { ...defaultProps, onCancel },
      });
      const dialog = screen.getByRole('dialog');
      await fireEvent.click(dialog);
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('does not call onCancel when inner content is clicked', async () => {
      const onCancel = vi.fn();
      render(CompareCandidatesModal, {
        props: { ...defaultProps, onCancel },
      });
      const inner = screen.getByRole('presentation');
      await fireEvent.click(inner);
      expect(onCancel).not.toHaveBeenCalled();
    });
  });
});
