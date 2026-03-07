import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/svelte';
import ComparisonView from '../comparison-view.svelte';
import {
  eventDetailFixture,
  eventDetailEvt2Fixture,
  comparisonFixture,
} from '../../test/fixtures/comparison-view';
import { reset as resetLoader } from '../../lib/utils/comparison-loader.svelte';

const mockGetEvent = vi.fn();
const mockGetStreams = vi.fn();
const mockGetComparison = vi.fn();
const mockCreateComparison = vi.fn();
const mockDeleteComparison = vi.fn();
const mockPush = vi.fn();
const mockReplace = vi.fn();

vi.mock('../../lib/api', () => ({
  getEvent: (...args: unknown[]) => mockGetEvent(...args),
  getStreams: (...args: unknown[]) => mockGetStreams(...args),
  getComparison: (...args: unknown[]) => mockGetComparison(...args),
  createComparison: (...args: unknown[]) => mockCreateComparison(...args),
  deleteComparison: (...args: unknown[]) => mockDeleteComparison(...args),
}));

vi.mock('svelte-spa-router', () => ({
  push: (...args: unknown[]) => mockPush(...args),
  replace: (...args: unknown[]) => mockReplace(...args),
  location: {
    subscribe: (fn: (v: string) => void) => {
      fn('#/compare/new');
      return () => {};
    },
  },
}));

describe('ComparisonView', () => {
  beforeEach(() => {
    resetLoader();
    vi.clearAllMocks();
    mockGetStreams.mockResolvedValue([]);
    mockGetEvent.mockImplementation((id: string) =>
      Promise.resolve(id === 'evt-1' ? eventDetailFixture : eventDetailEvt2Fixture)
    );
  });

  it('shows loading state when fetching events', async () => {
    const delay = 50;
    mockGetEvent.mockImplementation(
      (id: string) =>
        new Promise((r) =>
          setTimeout(() => r(id === 'evt-1' ? eventDetailFixture : eventDetailEvt2Fixture), delay)
        )
    );
    render(ComparisonView, {
      props: { params: { id: 'new' }, query: { events: 'evt-1,evt-2' } },
    });
    await waitFor(() => {
      const spinner = document.querySelector('svg.animate-spin');
      expect(spinner).toBeInTheDocument();
    });
  });

  it('shows error when getEvent fails', async () => {
    mockGetEvent.mockRejectedValue(new Error('Event not found'));
    render(ComparisonView, {
      props: { params: { id: 'new' }, query: { events: 'err-1,err-2' } },
    });
    await waitFor(() => {
      expect(screen.getByText('Event not found')).toBeInTheDocument();
    });
  });

  it('shows "At least 2 events are required" when query has fewer than 2 ids', async () => {
    render(ComparisonView, {
      props: { params: { id: 'new' }, query: { events: 'evt-1' } },
    });
    await waitFor(() => {
      expect(screen.getByText('At least 2 events are required for comparison')).toBeInTheDocument();
    });
  });

  it('loads events and shows comparison content when query has 2 event ids', async () => {
    render(ComparisonView, {
      props: { params: { id: 'new' }, query: { events: 'evt-1,evt-2' } },
    });
    await waitFor(() => {
      expect(mockGetEvent).toHaveBeenCalledWith(
        'evt-1',
        expect.objectContaining({ signal: expect.anything() })
      );
      expect(mockGetEvent).toHaveBeenCalledWith(
        'evt-2',
        expect.objectContaining({ signal: expect.anything() })
      );
    });
    await waitFor(() => {
      expect(screen.getByText('Event Comparison')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Save Comparison' })).toBeInTheDocument();
    });
  });

  it('Back button when new comparison pushes to Dashboard', async () => {
    render(ComparisonView, {
      props: { params: { id: 'new' }, query: { events: 'evt-1,evt-2' } },
    });
    await waitFor(() => {
      expect(screen.getByText('Event Comparison')).toBeInTheDocument();
    });
    await fireEvent.click(screen.getByRole('button', { name: '← Back to Dashboard' }));
    expect(mockPush).toHaveBeenCalledWith('/');
  });

  it('Save Comparison opens dialog with auto-generated name', async () => {
    render(ComparisonView, {
      props: { params: { id: 'new' }, query: { events: 'evt-1,evt-2' } },
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save Comparison' })).toBeInTheDocument();
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Save Comparison' }));
    await waitFor(() => {
      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
      expect(within(dialog).getByRole('heading', { name: 'Save Comparison' })).toBeInTheDocument();
    });
    expect(screen.getByPlaceholderText('Enter comparison name')).toBeInTheDocument();
    await fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' })
    );
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('handleSave calls createComparison and replace', async () => {
    const saved = { ...comparisonFixture, id: 'cmp-new', name: 'My Compare' };
    mockCreateComparison.mockResolvedValue(saved);
    render(ComparisonView, {
      props: { params: { id: 'new' }, query: { events: 'evt-1,evt-2' } },
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save Comparison' })).toBeInTheDocument();
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Save Comparison' }));
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
    await fireEvent.input(screen.getByPlaceholderText('Enter comparison name'), {
      target: { value: 'My Compare' },
    });
    await fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(mockCreateComparison).toHaveBeenCalledWith(
        'My Compare',
        ['act-1', 'act-2'],
        expect.any(Object),
        undefined
      );
    });
    expect(mockReplace).toHaveBeenCalledWith('/compare/cmp-new');
  });

  it('loads saved comparison and shows name and Delete button', async () => {
    mockGetComparison.mockResolvedValue(comparisonFixture);
    render(ComparisonView, { props: { params: { id: 'cmp-1' } } });
    await waitFor(() => {
      expect(mockGetComparison).toHaveBeenCalledWith(
        'cmp-1',
        expect.objectContaining({ signal: expect.anything() })
      );
    });
    await waitFor(() => {
      expect(mockGetEvent).toHaveBeenCalledWith(
        'evt-1',
        expect.objectContaining({ signal: expect.anything() })
      );
      expect(mockGetEvent).toHaveBeenCalledWith(
        'evt-2',
        expect.objectContaining({ signal: expect.anything() })
      );
    });
    await waitFor(() => {
      expect(screen.getByText('Run vs Ride')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '← Back to comparisons' })).toBeInTheDocument();
    });
  });

  it('Back button when saved comparison goes to comparisons', async () => {
    mockGetComparison.mockResolvedValue(comparisonFixture);
    render(ComparisonView, { props: { params: { id: 'cmp-1' } } });
    await waitFor(() => {
      expect(screen.getByText('Run vs Ride')).toBeInTheDocument();
    });
    await fireEvent.click(screen.getByRole('button', { name: '← Back to comparisons' }));
    expect(mockPush).toHaveBeenCalledWith('/comparisons');
  });

  it('handleDelete calls deleteComparison and push to comparisons', async () => {
    mockGetComparison.mockResolvedValue(comparisonFixture);
    mockDeleteComparison.mockResolvedValue(undefined);
    render(ComparisonView, { props: { params: { id: 'cmp-1' } } });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => {
      expect(mockDeleteComparison).toHaveBeenCalledWith('cmp-1');
    });
    expect(mockPush).toHaveBeenCalledWith('/comparisons');
  });

  it('shows error when getComparison fails', async () => {
    mockGetComparison.mockRejectedValue(new Error('Comparison not found'));
    render(ComparisonView, { props: { params: { id: 'cmp-err' } } });
    await waitFor(() => {
      expect(screen.getByText('Comparison not found')).toBeInTheDocument();
    });
  });

  it('xAxisMode toggle buttons are present and clickable', async () => {
    render(ComparisonView, {
      props: { params: { id: 'new' }, query: { events: 'evt-1,evt-2' } },
    });
    await waitFor(() => {
      expect(screen.getByText('Stream Comparison')).toBeInTheDocument();
    });
    const elapsedBtn = screen.getByRole('button', { name: 'Elapsed' });
    const wallClockBtn = screen.getByRole('button', { name: 'Wall Clock' });
    expect(elapsedBtn).toBeInTheDocument();
    expect(wallClockBtn).toBeInTheDocument();
    await fireEvent.click(wallClockBtn);
  });
});
