import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import FolderDeleteModal from '../FolderDeleteModal.svelte';
import type { Folder } from '../../../types/event';

const mockDeleteFolder = vi.fn();

vi.mock('../../../api/folders', () => ({
  deleteFolder: (...args: unknown[]) => mockDeleteFolder(...args),
}));

const folder: Folder = { id: 'f1', name: 'My Runs', color: '#ef4444', pinned: false };

const defaultProps = {
  folder,
  onDone: vi.fn(),
  onClosed: vi.fn(),
  onError: vi.fn(),
};

describe('FolderDeleteModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDeleteFolder.mockReset();
  });

  it('does not render when folder=null', () => {
    render(FolderDeleteModal, { props: { ...defaultProps, folder: null } });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders when folder is provided and shows folder name', () => {
    render(FolderDeleteModal, { props: defaultProps });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Delete folder "My Runs"/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Move contents to Unfiled' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete all contents' })).toBeInTheDocument();
  });

  it('ESC key calls onClosed', async () => {
    const onClosed = vi.fn();
    render(FolderDeleteModal, { props: { ...defaultProps, onClosed } });
    await fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClosed).toHaveBeenCalledTimes(1);
  });

  it('ESC key does not call onClosed while a delete is in progress', async () => {
    const onClosed = vi.fn();
    mockDeleteFolder.mockReturnValue(new Promise(() => {})); // never resolves
    render(FolderDeleteModal, { props: { ...defaultProps, onClosed } });
    await fireEvent.click(screen.getByRole('button', { name: 'Move contents to Unfiled' }));
    // Wait for deleting state to be reflected in the DOM
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Move contents to Unfiled' })).toBeDisabled();
    });
    await fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClosed).not.toHaveBeenCalled();
  });

  it('backdrop click calls onClosed', async () => {
    const onClosed = vi.fn();
    render(FolderDeleteModal, { props: { ...defaultProps, onClosed } });
    await fireEvent.click(screen.getByRole('dialog'));
    expect(onClosed).toHaveBeenCalledTimes(1);
  });

  it('"Move contents to Unfiled" calls deleteFolder(id, "unfile") and onDone', async () => {
    const onDone = vi.fn();
    mockDeleteFolder.mockResolvedValue({});
    render(FolderDeleteModal, { props: { ...defaultProps, onDone } });
    await fireEvent.click(screen.getByRole('button', { name: 'Move contents to Unfiled' }));
    await waitFor(() => {
      expect(mockDeleteFolder).toHaveBeenCalledWith('f1', 'unfile');
      expect(onDone).toHaveBeenCalled();
    });
  });

  it('"Delete all contents" calls deleteFolder(id, "delete") and onDone', async () => {
    const onDone = vi.fn();
    mockDeleteFolder.mockResolvedValue({});
    render(FolderDeleteModal, { props: { ...defaultProps, onDone } });
    await fireEvent.click(screen.getByRole('button', { name: 'Delete all contents' }));
    await waitFor(() => {
      expect(mockDeleteFolder).toHaveBeenCalledWith('f1', 'delete');
      expect(onDone).toHaveBeenCalled();
    });
  });

  it('action buttons are disabled while deleting', async () => {
    mockDeleteFolder.mockReturnValue(new Promise(() => {})); // never resolves
    render(FolderDeleteModal, { props: defaultProps });
    await fireEvent.click(screen.getByRole('button', { name: 'Move contents to Unfiled' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Move contents to Unfiled' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Delete all contents' })).toBeDisabled();
    });
  });

  it('API error calls onError', async () => {
    const onError = vi.fn();
    mockDeleteFolder.mockRejectedValue(new Error('Delete failed'));
    render(FolderDeleteModal, { props: { ...defaultProps, onError } });
    await fireEvent.click(screen.getByRole('button', { name: 'Move contents to Unfiled' }));
    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith('Delete failed');
    });
  });
});
