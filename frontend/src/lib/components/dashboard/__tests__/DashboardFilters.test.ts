import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/svelte';
import DashboardFilters from '../DashboardFilters.svelte';

describe('DashboardFilters', () => {
  const defaultProps = {
    searchInputValue: '',
    onSearchInput: vi.fn(),
    activityTypesOptions: ['running', 'cycling', 'hiking'],
    selectedActivityTypes: [] as string[],
    onToggleActivityType: vi.fn(),
    devicesOptions: ['Garmin', 'Wahoo'],
    selectedDevices: [] as string[],
    onToggleDevice: vi.fn(),
    dateStartStr: '',
    dateEndStr: '',
    onDateStartChange: vi.fn(),
    onDateEndChange: vi.fn(),
  };

  it('shows all activity types when dropdown open and filter is empty', async () => {
    render(DashboardFilters, { props: defaultProps });
    await fireEvent.click(screen.getByRole('button', { name: /Activity type/ }));
    expect(screen.getByText('running')).toBeInTheDocument();
    expect(screen.getByText('cycling')).toBeInTheDocument();
    expect(screen.getByText('hiking')).toBeInTheDocument();
  });

  it('opens device dropdown and closes activity type dropdown', async () => {
    render(DashboardFilters, { props: defaultProps });
    await fireEvent.click(screen.getByRole('button', { name: /Activity type/ }));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await fireEvent.click(screen.getByRole('button', { name: /Device/ }));
    expect(screen.getByText('Garmin')).toBeInTheDocument();
    expect(screen.getByText('Wahoo')).toBeInTheDocument();
    const listboxes = screen.getAllByRole('listbox');
    expect(listboxes).toHaveLength(1);
  });

  it('clears activity type filter when reopening dropdown after typing', async () => {
    render(DashboardFilters, { props: defaultProps });
    await fireEvent.click(screen.getByRole('button', { name: /Activity type/ }));
    const filterInput = screen.getByLabelText(/Filter activity types/i);
    await fireEvent.input(filterInput, { target: { value: 'run' } });
    expect(screen.getByDisplayValue('run')).toBeInTheDocument();
    await fireEvent.click(screen.getByRole('button', { name: /Activity type/ }));
    await fireEvent.click(screen.getByRole('button', { name: /Activity type/ }));
    const input = screen.getByLabelText(/Filter activity types/i);
    expect(input).toHaveValue('');
  });

  it('closes dropdowns on Escape key', async () => {
    render(DashboardFilters, { props: defaultProps });
    await fireEvent.click(screen.getByRole('button', { name: /Activity type/ }));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
  });

  it('focuses activity type filter input when dropdown opens', async () => {
    render(DashboardFilters, { props: defaultProps });
    await fireEvent.click(screen.getByRole('button', { name: /Activity type/ }));
    const filterInput = screen.getByLabelText(/Filter activity types/i);
    expect(filterInput).toBeInTheDocument();
    await waitFor(() => {
      expect(document.activeElement).toBe(filterInput);
    });
  });

  it('shows "No matching types" when filter matches no activity type', async () => {
    render(DashboardFilters, { props: defaultProps });
    await fireEvent.click(screen.getByRole('button', { name: /Activity type/ }));
    const filterInput = screen.getByLabelText(/Filter activity types/i);
    await fireEvent.input(filterInput, { target: { value: 'zzz' } });
    expect(screen.getByText('No matching types')).toBeInTheDocument();
  });

  it('shows device count and device list with checkboxes', async () => {
    const onToggleDevice = vi.fn();
    render(DashboardFilters, {
      props: {
        ...defaultProps,
        selectedDevices: ['Garmin'],
        onToggleDevice,
      },
    });
    await fireEvent.click(screen.getByRole('button', { name: /Device \(1\)/ }));
    expect(screen.getByText('Garmin')).toBeInTheDocument();
    expect(screen.getByText('Wahoo')).toBeInTheDocument();
    const garminCheckbox = screen.getByRole('checkbox', { name: /Garmin/i });
    const wahooCheckbox = screen.getByRole('checkbox', { name: /Wahoo/i });
    expect(garminCheckbox).toBeChecked();
    expect(wahooCheckbox).not.toBeChecked();
    await fireEvent.click(wahooCheckbox);
    expect(onToggleDevice).toHaveBeenCalledWith('Wahoo');
  });

  it('closes dropdown when overlay is clicked', async () => {
    render(DashboardFilters, { props: defaultProps });
    await fireEvent.click(screen.getByRole('button', { name: /Activity type/ }));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    const overlay = document.querySelector('[role="presentation"]');
    expect(overlay).toBeInTheDocument();
    await fireEvent.click(overlay!);
    await waitFor(() => {
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
  });
});
