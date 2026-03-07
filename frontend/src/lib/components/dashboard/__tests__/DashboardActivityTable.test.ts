import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import DashboardActivityTable from '../DashboardActivityTable.svelte';
import type { ActivityRow } from '../../../types';
import { activityRowFixture } from '../../../../test/fixtures/activity-rows';

function makeRow(overrides: Partial<ActivityRow> = {}): ActivityRow {
  return {
    ...activityRowFixture,
    ...overrides,
    event: { ...activityRowFixture.event, ...overrides.event },
    activity: { ...activityRowFixture.activity, ...overrides.activity },
  };
}

describe('DashboardActivityTable', () => {
  const defaultProps = {
    rows: [
      makeRow({ event: { ...activityRowFixture.event, id: 'evt-1', name: 'Run 1' } }),
      makeRow({
        event: { ...activityRowFixture.event, id: 'evt-2', name: 'Run 2' },
        activity: { ...activityRowFixture.activity, id: 'act-2', eventID: 'evt-2' },
      }),
    ],
    isLoading: false,
    selectedEventIds: new Set<string>(),
    uniqueEventIds: ['evt-1', 'evt-2'],
    selectAllChecked: false,
    selectAllIndeterminate: false,
    formatDurationCell: (stats: Record<string, unknown>) =>
      typeof stats.Duration === 'number' ? `${Math.floor(stats.Duration / 60)} min` : '—',
    formatAvgHeartRateCell: (stats: Record<string, unknown>) =>
      typeof stats['Average Heart Rate'] === 'number' ? String(stats['Average Heart Rate']) : '—',
    formatCaloriesCell: () => '—',
    formatDistanceCell: (stats: Record<string, unknown>) =>
      typeof stats.Distance === 'number' ? `${(stats.Distance as number) / 1000} km` : '—',
    onSelectAllChange: vi.fn(),
    onRowClick: vi.fn(),
    onToggleEventSelection: vi.fn(),
    onViewClick: vi.fn(),
    onFindComparisonsClick: vi.fn(),
    onMoveClick: vi.fn(),
    onDeleteClick: vi.fn(),
  };

  it('calls onRowClick with event id when row is clicked (not checkbox)', async () => {
    const onRowClick = vi.fn();
    render(DashboardActivityTable, {
      props: { ...defaultProps, onRowClick, rows: [makeRow()] },
    });
    const row = screen.getByRole('link', { name: undefined });
    await fireEvent.click(row);
    expect(onRowClick).toHaveBeenCalledWith('evt-1');
  });

  it('calls onRowClick when Enter is pressed on focused row', async () => {
    const onRowClick = vi.fn();
    render(DashboardActivityTable, {
      props: { ...defaultProps, onRowClick, rows: [makeRow()] },
    });
    const row = screen.getByRole('link');
    row.focus();
    await fireEvent.keyDown(row, { key: 'Enter' });
    expect(onRowClick).toHaveBeenCalledWith('evt-1');
  });

  it('calls onRowClick when Space is pressed on focused row', async () => {
    const onRowClick = vi.fn();
    render(DashboardActivityTable, {
      props: { ...defaultProps, onRowClick, rows: [makeRow()] },
    });
    const row = screen.getByRole('link');
    row.focus();
    await fireEvent.keyDown(row, { key: ' ' });
    expect(onRowClick).toHaveBeenCalledWith('evt-1');
  });

  it('does not call onRowClick when loading', async () => {
    const onRowClick = vi.fn();
    render(DashboardActivityTable, {
      props: { ...defaultProps, onRowClick, isLoading: true, rows: [makeRow()] },
    });
    const row = screen.getByRole('link');
    await fireEvent.click(row);
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it('calls onViewClick with event id and event when View button clicked', async () => {
    const onViewClick = vi.fn();
    render(DashboardActivityTable, {
      props: { ...defaultProps, onViewClick, rows: [makeRow()] },
    });
    const viewBtn = screen.getByRole('button', { name: /view/i });
    await fireEvent.click(viewBtn);
    expect(onViewClick).toHaveBeenCalledTimes(1);
    expect(onViewClick).toHaveBeenCalledWith('evt-1', expect.any(MouseEvent));
  });

  it('calls onFindComparisonsClick with event id when Find button clicked', async () => {
    const onFindComparisonsClick = vi.fn();
    render(DashboardActivityTable, {
      props: { ...defaultProps, onFindComparisonsClick, rows: [makeRow()] },
    });
    const findBtn = screen.getByRole('button', { name: /find/i });
    await fireEvent.click(findBtn);
    expect(onFindComparisonsClick).toHaveBeenCalledWith('evt-1');
  });

  it('calls onDeleteClick with event id and event when Delete button clicked', async () => {
    const onDeleteClick = vi.fn();
    render(DashboardActivityTable, {
      props: { ...defaultProps, onDeleteClick, rows: [makeRow()] },
    });
    const deleteBtn = screen.getByRole('button', { name: /delete/i });
    await fireEvent.click(deleteBtn);
    expect(onDeleteClick).toHaveBeenCalledTimes(1);
    expect(onDeleteClick).toHaveBeenCalledWith('evt-1', expect.any(MouseEvent));
  });

  it('calls onRowClick with correct event id for second row', async () => {
    const onRowClick = vi.fn();
    render(DashboardActivityTable, {
      props: { ...defaultProps, onRowClick },
    });
    const links = screen.getAllByRole('link');
    await fireEvent.click(links[1]);
    expect(onRowClick).toHaveBeenCalledWith('evt-2');
  });
});
