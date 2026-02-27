import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/svelte';
import Dashboard from '../dashboard.svelte';
import { activityRowsFixture } from '../../test/fixtures/activity-rows';

const mockGetActivityRows = vi.fn();
const mockUploadFiles = vi.fn();
const mockDeleteEvent = vi.fn();
const mockPush = vi.fn();

vi.mock('../../lib/api', () => ({
  getActivityRows: (...args: unknown[]) => mockGetActivityRows(...args),
  getActivityTypes: vi.fn(() => Promise.resolve(['running', 'cycling'])),
  getDevices: vi.fn(() => Promise.resolve(['Garmin', 'Wahoo'])),
  uploadFiles: (...args: unknown[]) => mockUploadFiles(...args),
  deleteEvent: (...args: unknown[]) => mockDeleteEvent(...args),
  getComparisonCandidates: vi.fn(() => Promise.resolve([])),
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

describe('Dashboard', () => {
  beforeEach(() => {
    mockGetActivityRows.mockReset();
    mockGetActivityRows.mockResolvedValue({ rows: activityRowsFixture, total: activityRowsFixture.length });
    mockUploadFiles.mockResolvedValue({ results: [] });
    mockDeleteEvent.mockResolvedValue(undefined);
    mockPush.mockReset();
  });

  it('shows loading state while fetching', async () => {
    mockGetActivityRows.mockReturnValue(new Promise(() => {}));
    render(Dashboard);
    await waitFor(() => {
      const spinner = document.querySelector('svg.animate-spin');
      expect(spinner).toBeInTheDocument();
    });
  });

  it('shows empty state when no rows', async () => {
    mockGetActivityRows.mockResolvedValue({ rows: [], total: 0 });
    render(Dashboard);
    await waitFor(() => {
      expect(screen.getByText(/No activities found/)).toBeInTheDocument();
    });
  });

  it('shows table with rows when data loaded', async () => {
    render(Dashboard);
    await waitFor(() => {
      expect(screen.getByText('Morning Run')).toBeInTheDocument();
    });
    expect(screen.getByText('running')).toBeInTheDocument();
  });

  it('shows toast on load error', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockGetActivityRows.mockRejectedValue(new Error('Load failed'));
    render(Dashboard);
    await waitFor(() => {
      expect(screen.getByText('Load failed')).toBeInTheDocument();
    });
    consoleError.mockRestore();
  });

  it('calls getActivityRows with filter params when activity type toggled', async () => {
    render(Dashboard);
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
    render(Dashboard);
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
    render(Dashboard);
    await waitFor(() => {
      expect(screen.getByText('View')).toBeInTheDocument();
    });
    await fireEvent.click(screen.getByRole('button', { name: 'View' }));
    expect(mockPush).toHaveBeenCalledWith('/event/evt-1');
  });

  it('opens single-delete flow when row Delete is clicked', async () => {
    render(Dashboard);
    await waitFor(() => {
      expect(screen.getByText('Delete')).toBeInTheDocument();
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
    render(Dashboard);
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
    render(Dashboard);
    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: 'Select event Morning Run' })).toBeInTheDocument();
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
    render(Dashboard);
    await waitFor(() => {
      expect(screen.getByText('Morning Run')).toBeInTheDocument();
    });
    const input = document.getElementById('dashboard-file-upload');
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
});
