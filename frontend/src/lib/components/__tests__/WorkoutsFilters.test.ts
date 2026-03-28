import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import WorkoutsFilters from '../workouts/WorkoutsFilters.svelte';

describe('WorkoutsFilters', () => {
  const defaultProps = {
    onSearchInput: vi.fn(),
    activityTypesOptions: ['running', 'cycling'],
    selectedActivityTypes: [],
    onToggleActivityType: vi.fn(),
    devicesOptions: ['Garmin', 'Suunto'],
    selectedDevices: [],
    onToggleDevice: vi.fn(),
    dateStartStr: '',
    dateEndStr: '',
    onDateStartChange: vi.fn(),
    onDateEndChange: vi.fn(),
    navFolders: [] as { id: string; name: string; color: string; pinned: boolean }[],
    activeFolderId: 'all',
    orphanFolderId: null as string | null,
    onFolderChange: vi.fn(),
  };

  it('renders search input and activity type filter', () => {
    render(WorkoutsFilters, { props: defaultProps });
    expect(screen.getByPlaceholderText('Search…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Activity type/ })).toBeInTheDocument();
  });

  it('calls onToggleActivityType when activity type checkbox changed', async () => {
    const onToggleActivityType = vi.fn();
    render(WorkoutsFilters, {
      props: {
        ...defaultProps,
        onToggleActivityType,
        selectedActivityTypes: [],
      },
    });
    await fireEvent.click(screen.getByRole('button', { name: /Activity type/ }));
    const runningCheckbox = await screen.findByRole('checkbox', { name: /running/i });
    await fireEvent.click(runningCheckbox);
    expect(onToggleActivityType).toHaveBeenCalledWith('running');
  });

  it('calls onDateStartChange when start date changed', async () => {
    const onDateStartChange = vi.fn();
    render(WorkoutsFilters, {
      props: { ...defaultProps, onDateStartChange },
    });
    const startInput = screen.getByLabelText('From');
    await fireEvent.change(startInput, { target: { value: '2024-01-01' } });
    expect(onDateStartChange).toHaveBeenCalledWith('2024-01-01');
  });

  it('renders folder select and calls onFolderChange', async () => {
    const onFolderChange = vi.fn();
    render(WorkoutsFilters, {
      props: {
        ...defaultProps,
        onFolderChange,
        navFolders: [{ id: 'f1', name: 'Runs', color: '#3b82f6', pinned: true }],
        activeFolderId: 'all',
      },
    });
    const select = screen.getByRole('combobox', { name: /Folder/i });
    expect(select).toBeInTheDocument();
    await fireEvent.change(select, { target: { value: 'unfiled' } });
    expect(onFolderChange).toHaveBeenCalledWith('unfiled');
  });

  it('shows unknown folder option when orphanFolderId is set', () => {
    render(WorkoutsFilters, {
      props: {
        ...defaultProps,
        activeFolderId: 'missing-id',
        orphanFolderId: 'missing-id',
      },
    });
    expect(screen.getByRole('option', { name: 'Unknown folder' })).toBeInTheDocument();
  });
});
