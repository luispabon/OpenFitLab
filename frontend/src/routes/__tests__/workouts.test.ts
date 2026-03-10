import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/svelte';
import Workouts from '../workouts.svelte';
import { activityRowsFixture } from '../../test/fixtures/activity-rows';
import { setFolderHash, foldersState } from '../../lib/stores/folders.svelte';

const mockGetActivityRows = vi.fn();
const mockUploadFiles = vi.fn();
const mockDeleteEvent = vi.fn();
const mockPush = vi.fn();
const mockGetComparisonCandidates = vi.fn();

vi.mock('../../lib/api', () => ({
  getActivityRows: (...args: unknown[]) => mockGetActivityRows(...args),
  getActivityTypes: vi.fn(() => Promise.resolve(['running', 'cycling'])),
  getDevices: vi.fn(() => Promise.resolve(['Garmin', 'Wahoo'])),
  uploadFiles: (...args: unknown[]) => mockUploadFiles(...args),
  deleteEvent: (...args: unknown[]) => mockDeleteEvent(...args),
  getComparisonCandidates: (...args: unknown[]) => mockGetComparisonCandidates(...args),
}));

vi.mock('../../lib/api/comparisons', () => ({
  getComparisonsByEventIds: vi.fn(() => Promise.resolve([])),
}));

vi.mock('svelte-spa-router', () => ({
  push: (...args: unknown[]) => mockPush(...args),
  querystring: {
    subscribe: (fn: (v: string) => void) => {
      fn('');
      return { unsubscribe: () => {} };
    },
  },
}));

describe('Workouts', () => {
  beforeEach(() => {
    mockGetActivityRows.mockReset();
    mockGetActivityRows.mockResolvedValue({
      rows: activityRowsFixture,
      total: activityRowsFixture.length,
    });
    mockUploadFiles.mockResolvedValue({ results: [] });
    mockDeleteEvent.mockResolvedValue(undefined);
    mockPush.mockReset();
    mockGetComparisonCandidates.mockReset();
    mockGetComparisonCandidates.mockResolvedValue([]);
  });

  afterEach(() => {
    setFolderHash('');
    foldersState.folders = [];
    foldersState.loading = false;
    vi.useRealTimers();
  });

  it('shows loading state while fetching', async () => {
    mockGetActivityRows.mockReturnValue(new Promise(() => {}));
    render(Workouts);
    await waitFor(() => {
      const spinner = document.querySelector('svg.animate-spin');
      expect(spinner).toBeInTheDocument();
    });
  });

  it('shows empty state when no rows', async () => {
    mockGetActivityRows.mockResolvedValue({ rows: [], total: 0 });
    render(Workouts);
    await waitFor(() => {
      expect(screen.getByText(/No activities found/)).toBeInTheDocument();
    });
  });

  it('shows table with rows when data loaded', async () => {
    render(Workouts);
    await waitFor(() => {
      expect(screen.getByText('Morning Run')).toBeInTheDocument();
    });
    expect(screen.getByText('running')).toBeInTheDocument();
  });

  it('shows toast on load error', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockGetActivityRows.mockRejectedValue(new Error('Load failed'));
    render(Workouts);
    await waitFor(() => {
      expect(screen.getByText('Load failed')).toBeInTheDocument();
    });
    consoleError.mockRestore();
  });

  it('calls getActivityRows with filter params when activity type toggled', async () => {
    render(Workouts);
    await waitFor(() => {
      expect(screen.getByText('Morning Run')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /Activity type/ }));
    await waitFor(() => {
      expect(screen.getByText('running')).toBeInTheDocument();
    });
    const runningCheckbox = screen.getByRole('checkbox', { name: /running/ });
    if (runningCheckbox) {
      fireEvent.click(runningCheckbox);
    }
    await waitFor(() => {
      expect(mockGetActivityRows).toHaveBeenLastCalledWith(
        expect.objectContaining({
          activityTypes: ['running'],
          offset: 0,
        })
      );
    });
  });

  it('calls getActivityRows with date range when dates set', async () => {
    render(Workouts);
    await waitFor(() => {
      expect(screen.getByText('Morning Run')).toBeInTheDocument();
    });
    const fromInput = screen.getByLabelText('From');
    const toInput = screen.getByLabelText('To');
    fireEvent.change(fromInput, { target: { value: '2024-01-01' } });
    fireEvent.change(toInput, { target: { value: '2024-01-31' } });
    await waitFor(() => {
      expect(mockGetActivityRows).toHaveBeenLastCalledWith(
        expect.objectContaining({
          startDate: expect.any(Number),
          endDate: expect.any(Number),
        })
      );
    });
  });

  it('pushes to event detail when row View is clicked', async () => {
    render(Workouts);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'View' })).toBeInTheDocument();
    });
    await fireEvent.click(screen.getByRole('button', { name: 'View' }));
    expect(mockPush).toHaveBeenCalledWith('/event/evt-1');
  });

  it('opens single-delete flow when row Delete is clicked', async () => {
    render(Workouts);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    });
    const deleteButtons = screen.getAllByRole('button', { name: 'Delete' });
    await fireEvent.click(deleteButtons[0]);
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  it('Compare button with 2 selected pushes to compare URL', async () => {
    const row2 = {
      ...activityRowsFixture[0],
      event: { ...activityRowsFixture[0].event, id: 'evt-2', name: 'Evening Run' },
      activity: { ...activityRowsFixture[0].activity, id: 'act-2' },
    };
    mockGetActivityRows.mockResolvedValue({
      rows: [activityRowsFixture[0], row2],
      total: 2,
    });
    render(Workouts);
    await waitFor(() => {
      expect(screen.getByText('Evening Run')).toBeInTheDocument();
    });
    await fireEvent.click(screen.getByRole('checkbox', { name: 'Select event Morning Run' }));
    await fireEvent.click(screen.getByRole('checkbox', { name: 'Select event Evening Run' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Compare' })).toBeInTheDocument();
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Compare' }));
    expect(mockPush).toHaveBeenCalledWith(expect.stringMatching(/^\/compare\/new\?events=/));
  });

  it('row selection shows bulk bar and Clear removes selection', async () => {
    render(Workouts);
    await waitFor(() => {
      expect(
        screen.getByRole('checkbox', { name: 'Select event Morning Run' })
      ).toBeInTheDocument();
    });
    await fireEvent.click(screen.getByRole('checkbox', { name: 'Select event Morning Run' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Clear' })).toBeInTheDocument();
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();
    });
  });

  it('upload success shows toast and reloads', async () => {
    const file = new File(['content'], 'workout.fit', { type: 'application/octet-stream' });
    mockUploadFiles.mockResolvedValue({
      results: [{ success: true, filename: 'workout.fit', id: 'evt-1', event: {}, activities: [] }],
    });
    render(Workouts);
    await waitFor(() => {
      expect(screen.getByText('Morning Run')).toBeInTheDocument();
    });
    const input = document.getElementById('workouts-file-upload');
    expect(input).toBeTruthy();
    fireEvent.change(input!, { target: { files: [file] } });
    await waitFor(() => {
      expect(mockUploadFiles).toHaveBeenCalled();
    });
    await waitFor(
      () => {
        expect(screen.getByText(/Uploaded 1 file successfully/)).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });

  it('search debounce commits search and refetches with search param', async () => {
    vi.useFakeTimers();
    render(Workouts);
    await waitFor(() => {
      expect(screen.getByText('Morning Run')).toBeInTheDocument();
    });
    const searchInput = screen.getByPlaceholderText('Search…');
    fireEvent.input(searchInput, { target: { value: 'run' } });
    expect(mockGetActivityRows).not.toHaveBeenLastCalledWith(
      expect.objectContaining({ search: 'run' })
    );
    await vi.advanceTimersByTimeAsync(300);
    await waitFor(() => {
      expect(mockGetActivityRows).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: 'run' })
      );
    });
  });

  it('calls getActivityRows with devices when device toggled', async () => {
    render(Workouts);
    await waitFor(() => {
      expect(screen.getByText('Morning Run')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /Device/ }));
    await waitFor(() => {
      expect(screen.getByText('Garmin')).toBeInTheDocument();
    });
    const garminCheckbox = screen.getByRole('checkbox', { name: /Garmin/ });
    if (garminCheckbox) {
      fireEvent.click(garminCheckbox);
    }
    await waitFor(() => {
      expect(mockGetActivityRows).toHaveBeenLastCalledWith(
        expect.objectContaining({
          devices: ['Garmin'],
          offset: 0,
        })
      );
    });
  });

  it('second toast clears first toast timeout', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockGetActivityRows.mockReset();
    mockGetActivityRows.mockRejectedValueOnce(new Error('First error'));
    render(Workouts);
    await waitFor(() => {
      expect(screen.getByText('First error')).toBeInTheDocument();
    });
    mockGetActivityRows.mockRejectedValueOnce(new Error('Second error'));
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2024-01-01' } });
    await waitFor(() => {
      expect(screen.getByText('Second error')).toBeInTheDocument();
    });
    consoleError.mockRestore();
  });

  it('upload with progress callback updates progress', async () => {
    let progressCb: ((p: number) => void) | undefined;
    mockUploadFiles.mockImplementation((_files: File[], onProgress?: (p: number) => void) => {
      progressCb = onProgress;
      return Promise.resolve({
        results: [{ success: true, filename: 'a.fit', id: 'evt-1', event: {}, activities: [] }],
      });
    });
    const file = new File(['x'], 'a.fit', { type: 'application/octet-stream' });
    render(Workouts);
    await waitFor(() => {
      expect(screen.getByText('Morning Run')).toBeInTheDocument();
    });
    const input = document.getElementById('workouts-file-upload');
    fireEvent.change(input!, { target: { files: [file] } });
    await waitFor(() => {
      expect(progressCb).toBeDefined();
    });
    progressCb!(50);
    progressCb!(100);
    await waitFor(
      () => {
        expect(screen.getByText(/Uploaded 1 file successfully/)).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });

  it('upload with mixed results shows success and failure toasts', async () => {
    mockUploadFiles.mockResolvedValue({
      results: [
        { success: true, filename: 'ok.fit', id: 'evt-1', event: {}, activities: [] },
        { success: false, filename: 'fail.fit' },
      ],
    });
    const files = [
      new File(['a'], 'ok.fit', { type: 'application/octet-stream' }),
      new File(['b'], 'fail.fit', { type: 'application/octet-stream' }),
    ];
    render(Workouts);
    await waitFor(() => {
      expect(screen.getByText('Morning Run')).toBeInTheDocument();
    });
    const input = document.getElementById('workouts-file-upload');
    fireEvent.change(input!, { target: { files } });
    await waitFor(
      () => {
        expect(screen.getByText(/Uploaded 1 file successfully/)).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
    await waitFor(
      () => {
        expect(screen.getByText(/Failed to upload 1 file: fail\.fit/)).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });

  it('upload batch error shows failed filenames toast', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockUploadFiles.mockRejectedValue(new Error('Network error'));
    const file = new File(['x'], 'broken.fit', { type: 'application/octet-stream' });
    render(Workouts);
    await waitFor(() => {
      expect(screen.getByText('Morning Run')).toBeInTheDocument();
    });
    const input = document.getElementById('workouts-file-upload');
    fireEvent.change(input!, { target: { files: [file] } });
    await waitFor(
      () => {
        expect(screen.getByText(/Failed to upload 1 file: broken\.fit/)).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
    consoleError.mockRestore();
  });

  it('select-all checkbox selects all when not all selected', async () => {
    const row2 = {
      ...activityRowsFixture[0],
      event: { ...activityRowsFixture[0].event, id: 'evt-2', name: 'Evening Run' },
      activity: { ...activityRowsFixture[0].activity, id: 'act-2' },
    };
    mockGetActivityRows.mockResolvedValue({
      rows: [activityRowsFixture[0], row2],
      total: 2,
    });
    render(Workouts);
    await waitFor(() => {
      expect(screen.getByText('Evening Run')).toBeInTheDocument();
    });
    const selectAllCheckbox = screen.getByRole('checkbox', { name: 'Select all events' });
    await fireEvent.click(selectAllCheckbox);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Compare' })).toBeInTheDocument();
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Compare' }));
    expect(mockPush).toHaveBeenCalledWith(expect.stringMatching(/^\/compare\/new\?events=/));
  });

  it('bulk delete confirm calls onDone and onClosed', async () => {
    mockDeleteEvent.mockResolvedValue(true);
    const row2 = {
      ...activityRowsFixture[0],
      event: { ...activityRowsFixture[0].event, id: 'evt-2', name: 'Evening Run' },
      activity: { ...activityRowsFixture[0].activity, id: 'act-2' },
    };
    mockGetActivityRows.mockResolvedValue({
      rows: [activityRowsFixture[0], row2],
      total: 2,
    });
    render(Workouts);
    await waitFor(() => {
      expect(screen.getByText('Evening Run')).toBeInTheDocument();
    });
    await fireEvent.click(screen.getByRole('checkbox', { name: 'Select event Morning Run' }));
    await fireEvent.click(screen.getByRole('checkbox', { name: 'Select event Evening Run' }));
    await waitFor(() => {
      expect(screen.getByText('2 events selected')).toBeInTheDocument();
    });
    const deleteButtons = screen.getAllByRole('button', { name: 'Delete' });
    await fireEvent.click(deleteButtons[0]);
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
    const dialog = screen.getByRole('dialog');
    const confirmBtn = within(dialog).getByRole('button', { name: 'Delete 2 Events' });
    await fireEvent.click(confirmBtn);
    await waitFor(() => {
      expect(screen.getByText(/Deleted 2 events successfully/)).toBeInTheDocument();
    });
    expect(mockDeleteEvent).toHaveBeenCalledWith('evt-1');
    expect(mockDeleteEvent).toHaveBeenCalledWith('evt-2');
  });

  it('single delete confirm calls onDone and onClosed', async () => {
    mockDeleteEvent.mockResolvedValue(true);
    render(Workouts);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    });
    const rowDeleteBtn = screen.getByRole('button', { name: 'Delete' });
    await fireEvent.click(rowDeleteBtn);
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
    const dialog = screen.getByRole('dialog');
    const confirmBtn = within(dialog).getByRole('button', { name: 'Delete' });
    await fireEvent.click(confirmBtn);
    await waitFor(() => {
      expect(screen.getByText('Event deleted successfully')).toBeInTheDocument();
    });
    expect(mockDeleteEvent).toHaveBeenCalledWith('evt-1');
  });

  it('single delete error shows toast via onError', async () => {
    mockDeleteEvent.mockResolvedValue(false);
    render(Workouts);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    });
    const rowDeleteBtn = screen.getByRole('button', { name: 'Delete' });
    await fireEvent.click(rowDeleteBtn);
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
    const dialog = screen.getByRole('dialog');
    const confirmBtn = within(dialog).getByRole('button', { name: 'Delete' });
    await fireEvent.click(confirmBtn);
    await waitFor(() => {
      expect(screen.getByText('Event not found')).toBeInTheDocument();
    });
  });

  it('Find comparisons opens CompareCandidatesFlow', async () => {
    mockGetComparisonCandidates.mockResolvedValue([
      { id: 'evt-2', name: 'Other Run', startDate: 0, stats: {} },
    ]);
    render(Workouts);
    await waitFor(() => {
      expect(screen.getByText('Morning Run')).toBeInTheDocument();
    });
    const findButton = screen.getByRole('button', { name: 'Find comparisons' });
    await fireEvent.click(findButton);
    await waitFor(() => {
      expect(mockGetComparisonCandidates).toHaveBeenCalledWith('evt-1', {
        sameFolderOnly: true,
      });
    });
  });

  it('CompareCandidatesFlow onCompare pushes to compare URL', async () => {
    mockGetComparisonCandidates.mockResolvedValue([
      { id: 'evt-2', name: 'Other Run', startDate: 0, stats: {} },
    ]);
    render(Workouts);
    await waitFor(() => {
      expect(screen.getByText('Morning Run')).toBeInTheDocument();
    });
    const findButton = screen.getByRole('button', { name: 'Find comparisons' });
    await fireEvent.click(findButton);
    await waitFor(() => {
      expect(screen.getByText('Other Run')).toBeInTheDocument();
    });
    const dialog = screen.getByRole('dialog');
    const candidateCheckbox = within(dialog).getByRole('checkbox');
    await fireEvent.click(candidateCheckbox);
    const compareBtn = within(dialog).getByRole('button', { name: /Compare \(2 events\)/ });
    await fireEvent.click(compareBtn);
    expect(mockPush).toHaveBeenCalledWith(
      expect.stringMatching(/^\/compare\/new\?events=evt-1(?:%2C|,)evt-2/)
    );
  });

  it('CompareCandidatesFlow onCompare includes back param when viewing a folder', async () => {
    setFolderHash('#/?folder=my-folder-id');
    mockGetComparisonCandidates.mockResolvedValue([
      { id: 'evt-2', name: 'Other Run', startDate: 0, stats: {} },
    ]);
    render(Workouts);
    await waitFor(() => {
      expect(screen.getByText('Morning Run')).toBeInTheDocument();
    });
    const findButton = screen.getByRole('button', { name: 'Find comparisons' });
    await fireEvent.click(findButton);
    await waitFor(() => {
      expect(screen.getByText('Other Run')).toBeInTheDocument();
    });
    const dialog = screen.getByRole('dialog');
    const candidateCheckbox = within(dialog).getByRole('checkbox');
    await fireEvent.click(candidateCheckbox);
    const compareBtn = within(dialog).getByRole('button', { name: /Compare \(2 events\)/ });
    await fireEvent.click(compareBtn);
    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('back=my-folder-id'));
  });

  it('CompareCandidatesFlow onError shows toast when candidates fail', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockGetComparisonCandidates.mockRejectedValue(new Error('Candidates failed'));
    render(Workouts);
    await waitFor(() => {
      expect(screen.getByText('Morning Run')).toBeInTheDocument();
    });
    const findButton = screen.getByRole('button', { name: 'Find comparisons' });
    await fireEvent.click(findButton);
    await waitFor(() => {
      expect(screen.getByText('Candidates failed')).toBeInTheDocument();
    });
    consoleError.mockRestore();
  });

  it('shows folder not found banner when folder ID is unknown', async () => {
    setFolderHash('#/?folder=non-existent-uuid');
    foldersState.loading = false;
    foldersState.folders = [];
    render(Workouts);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Folder not found. It may have been deleted.'
      );
    });
  });

  it('does not show folder not found banner when folder ID is known', async () => {
    const knownId = 'known-folder-uuid';
    setFolderHash(`#/?folder=${knownId}`);
    foldersState.loading = false;
    foldersState.folders = [{ id: knownId, name: 'My Folder', color: '#3b82f6', pinned: false }];
    render(Workouts);
    await waitFor(() => {
      expect(screen.getByText('Morning Run')).toBeInTheDocument();
    });
    expect(
      screen.queryByText('Folder not found. It may have been deleted.')
    ).not.toBeInTheDocument();
  });
});
