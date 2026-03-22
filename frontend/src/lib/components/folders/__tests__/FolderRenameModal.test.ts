import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import FolderRenameModal from '../FolderRenameModal.svelte';
import type { Folder } from '../../../types/event';

const mockUpdateFolder = vi.fn();

vi.mock('../../../api/folders', () => ({
  updateFolder: (...args: unknown[]) => mockUpdateFolder(...args),
}));

const folder: Folder = { id: 'f1', name: 'My Runs', color: '#ef4444', pinned: false };

const defaultProps = {
  folder,
  existingNames: ['My Runs', 'Cycling'],
  onDone: vi.fn(),
  onClosed: vi.fn(),
  onError: vi.fn(),
};

describe('FolderRenameModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateFolder.mockReset();
  });

  it('does not render when folder=null', () => {
    render(FolderRenameModal, {
      props: { ...defaultProps, folder: null, existingNames: [] },
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders and pre-fills the current folder name', async () => {
    render(FolderRenameModal, { props: defaultProps });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Rename folder')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByDisplayValue('My Runs')).toBeInTheDocument();
    });
  });

  it('Save button is disabled when name is empty', async () => {
    render(FolderRenameModal, { props: defaultProps });
    const input = screen.getByPlaceholderText('Folder name');
    await fireEvent.input(input, { target: { value: '' } });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    });
  });

  it('shows duplicate warning and disables Save when name matches another folder (case-insensitive)', async () => {
    render(FolderRenameModal, { props: defaultProps });
    const input = screen.getByPlaceholderText('Folder name');
    await fireEvent.input(input, { target: { value: 'cycling' } });
    await waitFor(() => {
      expect(screen.getByText('A folder with this name already exists.')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('Save button is enabled when name is changed to a unique value', async () => {
    render(FolderRenameModal, { props: defaultProps });
    const input = screen.getByPlaceholderText('Folder name');
    await fireEvent.input(input, { target: { value: 'New Name' } });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save' })).not.toBeDisabled();
    });
  });

  it('ESC key calls onClosed', async () => {
    const onClosed = vi.fn();
    render(FolderRenameModal, { props: { ...defaultProps, onClosed } });
    await fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClosed).toHaveBeenCalledTimes(1);
  });

  it('backdrop click calls onClosed', async () => {
    const onClosed = vi.fn();
    render(FolderRenameModal, { props: { ...defaultProps, onClosed } });
    await fireEvent.click(screen.getByRole('dialog'));
    expect(onClosed).toHaveBeenCalledTimes(1);
  });

  it('successful rename calls updateFolder and onDone', async () => {
    const onDone = vi.fn();
    const onClosed = vi.fn();
    mockUpdateFolder.mockResolvedValue({});
    render(FolderRenameModal, { props: { ...defaultProps, onDone, onClosed } });
    const input = screen.getByPlaceholderText('Folder name');
    await fireEvent.input(input, { target: { value: 'Morning Runs' } });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save' })).not.toBeDisabled();
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(mockUpdateFolder).toHaveBeenCalledWith('f1', { name: 'Morning Runs' });
      expect(onDone).toHaveBeenCalled();
      expect(onClosed).toHaveBeenCalled();
    });
  });

  it('API error calls onError', async () => {
    const onError = vi.fn();
    mockUpdateFolder.mockRejectedValue(new Error('Server error'));
    render(FolderRenameModal, { props: { ...defaultProps, onError } });
    const input = screen.getByPlaceholderText('Folder name');
    await fireEvent.input(input, { target: { value: 'Morning Runs' } });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save' })).not.toBeDisabled();
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith('Server error');
    });
  });
});
