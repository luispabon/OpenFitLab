import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';
import Dashboard from '../dashboard.svelte';
import { activityRowsFixture } from '../../test/fixtures/activity-rows';

const mockGetActivityRows = vi.fn();

vi.mock('../../lib/api', () => ({
  getActivityRows: (...args: unknown[]) => mockGetActivityRows(...args),
  getActivityTypes: vi.fn(() => Promise.resolve([])),
  getDevices: vi.fn(() => Promise.resolve([])),
  uploadFile: vi.fn(),
  deleteEvent: vi.fn(),
}));

vi.mock('svelte-spa-router', () => ({
  push: vi.fn(() => Promise.resolve()),
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
    mockGetActivityRows.mockResolvedValue({
      rows: activityRowsFixture,
      total: activityRowsFixture.length,
    });
    render(Dashboard);
    await waitFor(() => {
      expect(screen.getByText('Morning Run')).toBeInTheDocument();
    });
    expect(screen.getByText('running')).toBeInTheDocument();
  });
});
