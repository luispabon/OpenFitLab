import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import FolderColorModal from '../FolderColorModal.svelte';
import type { Folder } from '../../../types/event';
import { FOLDER_PRESET_COLORS } from '../../../types/event';

const mockUpdateFolder = vi.fn();

vi.mock('../../../api/folders', () => ({
  updateFolder: (...args: unknown[]) => mockUpdateFolder(...args),
}));

const folder: Folder = { id: 'f1', name: 'My Runs', color: '#ef4444', pinned: false };

const defaultProps = {
  folder,
  onDone: vi.fn(),
  onClosed: vi.fn(),
  onError: vi.fn(),
};

describe('FolderColorModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateFolder.mockReset();
  });

  it('does not render when folder=null', () => {
    render(FolderColorModal, { props: { ...defaultProps, folder: null } });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders when folder is provided and shows color swatches', () => {
    render(FolderColorModal, { props: defaultProps });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Folder color')).toBeInTheDocument();
    // Each preset color has a button
    for (const c of FOLDER_PRESET_COLORS) {
      expect(screen.getByRole('button', { name: `Color ${c}` })).toBeInTheDocument();
    }
  });

  it('ESC key calls onClosed', async () => {
    const onClosed = vi.fn();
    render(FolderColorModal, { props: { ...defaultProps, onClosed } });
    await fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClosed).toHaveBeenCalledTimes(1);
  });

  it('backdrop click calls onClosed', async () => {
    const onClosed = vi.fn();
    render(FolderColorModal, { props: { ...defaultProps, onClosed } });
    await fireEvent.click(screen.getByRole('dialog'));
    expect(onClosed).toHaveBeenCalledTimes(1);
  });

  it('selecting a color then clicking Save calls updateFolder with selected color and onDone', async () => {
    const onDone = vi.fn();
    const onClosed = vi.fn();
    mockUpdateFolder.mockResolvedValue({});
    render(FolderColorModal, { props: { ...defaultProps, onDone, onClosed } });
    // Pick a different color from the current one
    const newColor = FOLDER_PRESET_COLORS[2]; // '#eab308'
    await fireEvent.click(screen.getByRole('button', { name: `Color ${newColor}` }));
    await fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(mockUpdateFolder).toHaveBeenCalledWith('f1', { color: newColor });
      expect(onDone).toHaveBeenCalled();
      expect(onClosed).toHaveBeenCalled();
    });
  });

  it('API error calls onError', async () => {
    const onError = vi.fn();
    mockUpdateFolder.mockRejectedValue(new Error('Update failed'));
    render(FolderColorModal, { props: { ...defaultProps, onError } });
    await fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith('Update failed');
    });
  });
});
