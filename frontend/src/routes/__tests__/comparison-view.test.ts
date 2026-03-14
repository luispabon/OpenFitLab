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
const mockUpdateComparisonSettings = vi.fn();
const mockUpdateComparisonName = vi.fn();
const mockPush = vi.fn();
const mockReplace = vi.fn();

vi.mock('../../lib/api', () => ({
  getEvent: (...args: unknown[]) => mockGetEvent(...args),
  getStreams: (...args: unknown[]) => mockGetStreams(...args),
  getComparison: (...args: unknown[]) => mockGetComparison(...args),
  createComparison: (...args: unknown[]) => mockCreateComparison(...args),
  deleteComparison: (...args: unknown[]) => mockDeleteComparison(...args),
  updateComparisonSettings: (...args: unknown[]) => mockUpdateComparisonSettings(...args),
  updateComparisonName: (...args: unknown[]) => mockUpdateComparisonName(...args),
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

vi.mock('../../lib/stores/folders.svelte', () => ({
  foldersState: {
    folders: [{ id: 'folder-1', name: 'Running', color: '#22c55e', pinned: false }],
  },
  buildFolderHash: (folderId: string) => {
    if (folderId === 'all') return '#/';
    return `#/?folder=${encodeURIComponent(folderId)}`;
  },
}));

describe('ComparisonView', () => {
  beforeEach(() => {
    resetLoader();
    vi.clearAllMocks();
    mockGetStreams.mockResolvedValue([]);
    mockUpdateComparisonSettings.mockResolvedValue(undefined);
    mockUpdateComparisonName.mockResolvedValue(undefined);
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
      expect(
        screen.getByText('running / Garmin Forerunner 945 vs Wahoo Elemnt')
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Save Comparison' })).toBeInTheDocument();
    });
  });

  it('Back button when new comparison with no back param pushes to /', async () => {
    render(ComparisonView, {
      props: { params: { id: 'new' }, query: { events: 'evt-1,evt-2' } },
    });
    await waitFor(() => {
      expect(
        screen.getByText('running / Garmin Forerunner 945 vs Wahoo Elemnt')
      ).toBeInTheDocument();
    });
    await fireEvent.click(screen.getByRole('button', { name: '← Back to Workouts' }));
    expect(mockPush).toHaveBeenCalledWith('/');
  });

  it('Back button when new comparison with back param pushes to folder URL', async () => {
    render(ComparisonView, {
      props: { params: { id: 'new' }, query: { events: 'evt-1,evt-2', back: 'folder-abc' } },
    });
    await waitFor(() => {
      expect(
        screen.getByText('running / Garmin Forerunner 945 vs Wahoo Elemnt')
      ).toBeInTheDocument();
    });
    await fireEvent.click(screen.getByRole('button', { name: '← Back to Workouts' }));
    expect(mockPush).toHaveBeenCalledWith('#/?folder=folder-abc');
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

  it('passes inferred folderId to createComparison when all events share the same folder', async () => {
    const evt1WithFolder = {
      ...eventDetailFixture,
      event: { ...eventDetailFixture.event, folderId: 'folder-1' },
    };
    const evt2WithFolder = {
      ...eventDetailEvt2Fixture,
      event: { ...eventDetailEvt2Fixture.event, folderId: 'folder-1' },
    };
    mockGetEvent.mockImplementation((id: string) =>
      Promise.resolve(id === 'evt-1' ? evt1WithFolder : evt2WithFolder)
    );
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
    expect(screen.getByText('Will be saved to: Running')).toBeInTheDocument();
    await fireEvent.input(screen.getByPlaceholderText('Enter comparison name'), {
      target: { value: 'My Compare' },
    });
    await fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(mockCreateComparison).toHaveBeenCalledWith(
        'My Compare',
        ['act-1', 'act-2'],
        expect.any(Object),
        'folder-1'
      );
    });
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

  it('shows hidden stats banner when saved comparison has hiddenStats in settings', async () => {
    const compWithHidden = {
      ...comparisonFixture,
      settings: { hiddenStats: ['Duration', 'Distance'] },
    };
    mockGetComparison.mockResolvedValue(compWithHidden);
    render(ComparisonView, { props: { params: { id: 'cmp-1' } } });
    await waitFor(() => {
      expect(screen.getByText(/2 rows hidden/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Show all' })).toBeInTheDocument();
    });
  });

  it('"Show all" clears hidden stats and calls updateComparisonSettings for saved comparison', async () => {
    const compWithHidden = {
      ...comparisonFixture,
      settings: { hiddenStats: ['Duration'] },
    };
    mockGetComparison.mockResolvedValue(compWithHidden);
    render(ComparisonView, { props: { params: { id: 'cmp-1' } } });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Show all' })).toBeInTheDocument();
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Show all' }));
    await waitFor(() => {
      expect(screen.queryByText(/row.*hidden/)).not.toBeInTheDocument();
    });
    expect(mockUpdateComparisonSettings).toHaveBeenCalledWith(
      'cmp-1',
      expect.objectContaining({ hiddenStats: [] })
    );
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

  describe('inline name editing (saved comparison)', () => {
    it('clicking comparison name opens name editor with current value', async () => {
      mockGetComparison.mockResolvedValue(comparisonFixture);
      render(ComparisonView, { props: { params: { id: 'cmp-1' } } });
      await waitFor(() => {
        expect(screen.getByText('Run vs Ride')).toBeInTheDocument();
      });
      await fireEvent.click(screen.getByText('Run vs Ride'));
      await waitFor(() => {
        const input = screen.getByPlaceholderText('Comparison name');
        expect(input).toBeInTheDocument();
        expect(input).toHaveValue('Run vs Ride');
      });
    });

    it('Enter key in name editor calls updateComparisonName and updates displayed name', async () => {
      mockGetComparison.mockResolvedValue(comparisonFixture);
      render(ComparisonView, { props: { params: { id: 'cmp-1' } } });
      await waitFor(() => {
        expect(screen.getByText('Run vs Ride')).toBeInTheDocument();
      });
      await fireEvent.click(screen.getByText('Run vs Ride'));
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Comparison name')).toHaveValue('Run vs Ride');
      });
      const input = screen.getByPlaceholderText('Comparison name');
      await fireEvent.input(input, { target: { value: 'New Name' } });
      await fireEvent.keyDown(input, { key: 'Enter' });
      await waitFor(() => {
        expect(mockUpdateComparisonName).toHaveBeenCalledWith('cmp-1', 'New Name');
      });
      await waitFor(() => {
        expect(screen.getByText('New Name')).toBeInTheDocument();
      });
    });

    it('Escape key in name editor closes without saving', async () => {
      mockGetComparison.mockResolvedValue(comparisonFixture);
      render(ComparisonView, { props: { params: { id: 'cmp-1' } } });
      await waitFor(() => {
        expect(screen.getByText('Run vs Ride')).toBeInTheDocument();
      });
      await fireEvent.click(screen.getByText('Run vs Ride'));
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Comparison name')).toBeInTheDocument();
      });
      const input = screen.getByPlaceholderText('Comparison name');
      await fireEvent.keyDown(input, { key: 'Escape' });
      await waitFor(() => {
        expect(screen.queryByPlaceholderText('Comparison name')).not.toBeInTheDocument();
        expect(screen.getByText('Run vs Ride')).toBeInTheDocument();
      });
      expect(mockUpdateComparisonName).not.toHaveBeenCalled();
    });

    it('shows error message when updateComparisonName fails', async () => {
      mockGetComparison.mockResolvedValue(comparisonFixture);
      mockUpdateComparisonName.mockRejectedValue(new Error('Network error'));
      render(ComparisonView, { props: { params: { id: 'cmp-1' } } });
      await waitFor(() => {
        expect(screen.getByText('Run vs Ride')).toBeInTheDocument();
      });
      await fireEvent.click(screen.getByText('Run vs Ride'));
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Comparison name')).toBeInTheDocument();
      });
      const input = screen.getByPlaceholderText('Comparison name');
      await fireEvent.input(input, { target: { value: 'New Name' } });
      await fireEvent.keyDown(input, { key: 'Enter' });
      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });
  });

  it('auto-generated comparison name includes activity type when available', async () => {
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
    const nameInput = screen.getByPlaceholderText('Enter comparison name');
    expect(nameInput).toHaveValue('running / Garmin Forerunner 945 vs Wahoo Elemnt');
  });

  it('Reference Device section shows "View original event" links that navigate with back param', async () => {
    render(ComparisonView, {
      props: { params: { id: 'new' }, query: { events: 'evt-1,evt-2' } },
    });
    await waitFor(() => {
      expect(
        screen.getByText('running / Garmin Forerunner 945 vs Wahoo Elemnt')
      ).toBeInTheDocument();
    });
    const viewEventButtons = screen.getAllByRole('button', {
      name: 'View original event',
    });
    expect(viewEventButtons.length).toBeGreaterThanOrEqual(2);
    await fireEvent.click(viewEventButtons[0]);
    expect(mockPush).toHaveBeenCalledWith(
      '/event/evt-1?back=' + encodeURIComponent('/compare/new?events=evt-1,evt-2')
    );
  });

  it('saved comparison event link includes back path to comparison', async () => {
    mockGetComparison.mockResolvedValue(comparisonFixture);
    render(ComparisonView, { props: { params: { id: 'cmp-1' } } });
    await waitFor(() => {
      expect(screen.getByText('Run vs Ride')).toBeInTheDocument();
    });
    const viewEventButtons = screen.getAllByRole('button', {
      name: 'View original event',
    });
    expect(viewEventButtons.length).toBeGreaterThanOrEqual(2);
    await fireEvent.click(viewEventButtons[0]);
    expect(mockPush).toHaveBeenCalledWith(
      '/event/evt-1?back=' + encodeURIComponent('/compare/cmp-1')
    );
  });

  it('when first device activity is "Other", uses second device activity type for name prefix', async () => {
    const evt1Other = {
      ...eventDetailFixture,
      activities: [{ ...eventDetailFixture.activities[0], type: 'Other' }],
    };
    const evt2Cycling = {
      ...eventDetailEvt2Fixture,
      activities: [{ ...eventDetailEvt2Fixture.activities[0], type: 'Cycling' }],
    };
    mockGetEvent.mockImplementation((id: string) =>
      Promise.resolve(id === 'evt-1' ? evt1Other : evt2Cycling)
    );
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
    const nameInput = screen.getByPlaceholderText('Enter comparison name');
    expect(nameInput).toHaveValue('Cycling / Garmin Forerunner 945 vs Wahoo Elemnt');
  });

  it('reloads data when page becomes visible again (visibilitychange)', async () => {
    render(ComparisonView, {
      props: { params: { id: 'new' }, query: { events: 'evt-1,evt-2' } },
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save Comparison' })).toBeInTheDocument();
    });
    const getEventCallsBefore = mockGetEvent.mock.calls.length;
    expect(getEventCallsBefore).toBeGreaterThanOrEqual(2);

    // Simulate tab becoming visible again (e.g. user switched back to this tab)
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));

    await waitFor(() => {
      expect(mockGetEvent.mock.calls.length).toBeGreaterThan(getEventCallsBefore);
    });
  });
});
