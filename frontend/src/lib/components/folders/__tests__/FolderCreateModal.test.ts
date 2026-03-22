import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import FolderCreateModal from '../FolderCreateModal.svelte';
import type { Folder } from '../../../types/event';

const mockCreateFolder = vi.fn();

vi.mock('../../../api/folders', () => ({
  createFolder: (...args: unknown[]) => mockCreateFolder(...args),
}));

const createdFolder: Folder = { id: 'f1', name: 'My Runs', color: '#ef4444', pinned: false };

const defaultProps = {
  open: true,
  onCreated: vi.fn(),
  onClosed: vi.fn(),
  onError: vi.fn(),
  existingNames: [] as string[],
  maxFolders: 20,
};

describe('FolderCreateModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateFolder.mockReset();
  });

  it('does not render when open=false', () => {
    render(FolderCreateModal, { props: { ...defaultProps, open: false } });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders dialog when open=true', () => {
    render(FolderCreateModal, { props: defaultProps });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('New folder')).toBeInTheDocument();
  });

  it('shows at-limit message and hides form when existingNames.length >= maxFolders', () => {
    render(FolderCreateModal, {
      props: { ...defaultProps, existingNames: ['A', 'B'], maxFolders: 2 },
    });
    expect(screen.getByText(/Maximum 2 folders reached/)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Folder name')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create' })).not.toBeInTheDocument();
  });

  it('Create button is disabled when name is empty', () => {
    render(FolderCreateModal, { props: defaultProps });
    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled();
  });

  it('shows duplicate warning and disables Create when name matches existing (case-insensitive)', async () => {
    render(FolderCreateModal, {
      props: { ...defaultProps, existingNames: ['My Runs'] },
    });
    await fireEvent.input(screen.getByPlaceholderText('Folder name'), {
      target: { value: 'my runs' },
    });
    await waitFor(() => {
      expect(screen.getByText('A folder with this name already exists.')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled();
  });

  it('Enter key in name input submits when canSubmit', async () => {
    mockCreateFolder.mockResolvedValue(createdFolder);
    render(FolderCreateModal, { props: defaultProps });
    const input = screen.getByPlaceholderText('Folder name');
    await fireEvent.input(input, { target: { value: 'My Runs' } });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Create' })).not.toBeDisabled();
    });
    await fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => {
      expect(mockCreateFolder).toHaveBeenCalledWith({
        name: 'My Runs',
        color: expect.any(String),
      });
    });
  });

  it('Enter key does not submit when name is empty', async () => {
    render(FolderCreateModal, { props: defaultProps });
    const input = screen.getByPlaceholderText('Folder name');
    await fireEvent.keyDown(input, { key: 'Enter' });
    expect(mockCreateFolder).not.toHaveBeenCalled();
  });

  it('ESC key calls onClosed', async () => {
    const onClosed = vi.fn();
    render(FolderCreateModal, { props: { ...defaultProps, onClosed } });
    await fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClosed).toHaveBeenCalledTimes(1);
  });

  it('backdrop click calls onClosed', async () => {
    const onClosed = vi.fn();
    render(FolderCreateModal, { props: { ...defaultProps, onClosed } });
    await fireEvent.click(screen.getByRole('dialog'));
    expect(onClosed).toHaveBeenCalledTimes(1);
  });

  it('successful create calls createFolder, onCreated, and onClosed', async () => {
    const onCreated = vi.fn();
    const onClosed = vi.fn();
    mockCreateFolder.mockResolvedValue(createdFolder);
    render(FolderCreateModal, { props: { ...defaultProps, onCreated, onClosed } });
    await fireEvent.input(screen.getByPlaceholderText('Folder name'), {
      target: { value: 'My Runs' },
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Create' })).not.toBeDisabled();
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() => {
      expect(mockCreateFolder).toHaveBeenCalledWith({
        name: 'My Runs',
        color: expect.any(String),
      });
      expect(onCreated).toHaveBeenCalledWith(createdFolder);
      expect(onClosed).toHaveBeenCalled();
    });
  });

  it('API error calls onError', async () => {
    const onError = vi.fn();
    mockCreateFolder.mockRejectedValue(new Error('Network failure'));
    render(FolderCreateModal, { props: { ...defaultProps, onError } });
    await fireEvent.input(screen.getByPlaceholderText('Folder name'), {
      target: { value: 'My Runs' },
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Create' })).not.toBeDisabled();
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith('Network failure');
    });
  });
});
