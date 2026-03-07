import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import DashboardBulkActionBar from '../DashboardBulkActionBar.svelte';

describe('DashboardBulkActionBar', () => {
  const defaultProps = {
    selectedCount: 1,
    onClear: vi.fn(),
    onCompare: vi.fn(),
    onMove: vi.fn(),
    onDelete: vi.fn(),
  };

  it('renders nothing when selectedCount is 0', () => {
    render(DashboardBulkActionBar, {
      props: { ...defaultProps, selectedCount: 0 },
    });
    expect(screen.queryByText(/selected/)).not.toBeInTheDocument();
  });

  it('shows singular "event" when selectedCount is 1', () => {
    render(DashboardBulkActionBar, { props: defaultProps });
    expect(screen.getByText('1 event selected')).toBeInTheDocument();
  });

  it('shows plural "events" when selectedCount is 2', () => {
    render(DashboardBulkActionBar, {
      props: { ...defaultProps, selectedCount: 2 },
    });
    expect(screen.getByText('2 events selected')).toBeInTheDocument();
  });

  it('calls onClear when Clear is clicked', async () => {
    const onClear = vi.fn();
    render(DashboardBulkActionBar, {
      props: { ...defaultProps, onClear },
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
