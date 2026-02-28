import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import DashboardUploadSection from '../DashboardUploadSection.svelte';
import DashboardUploadSectionWrapper from './DashboardUploadSectionWrapper.svelte';

function createDragEvent(
  type: 'dragenter' | 'dragover' | 'dragleave' | 'drop',
  payload: { types?: string[]; files?: File[]; relatedTarget?: Node | null }
) {
  const e = new Event(type, { bubbles: true, cancelable: true }) as DragEvent;
  Object.defineProperty(e, 'dataTransfer', {
    value: {
      types: payload.types ?? [],
      files: payload.files ?? [],
    },
    writable: false,
  });
  if (payload.relatedTarget !== undefined) {
    Object.defineProperty(e, 'relatedTarget', { value: payload.relatedTarget, writable: false });
  }
  return e;
}

describe('DashboardUploadSection', () => {
  it('renders Dashboard heading, upload label, and region with aria-label', () => {
    render(DashboardUploadSection, {
      props: {
        isUploading: false,
        onFilesSelected: () => {},
      },
    });
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByText('Upload Activity Files')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Dashboard upload area' })).toBeInTheDocument();
  });

  it('file input has default accept, multiple, and id', () => {
    render(DashboardUploadSection, {
      props: {
        isUploading: false,
        onFilesSelected: () => {},
      },
    });
    const input = document.getElementById('dashboard-file-upload');
    expect(input).toBeTruthy();
    expect(input).toHaveAttribute('accept', '.json,.tcx,.fit,.gpx,.sml');
    expect(input).toHaveAttribute('multiple');
    expect(input).toHaveAttribute('type', 'file');
  });

  it('file input is disabled when isUploading is true', () => {
    render(DashboardUploadSection, {
      props: {
        isUploading: true,
        onFilesSelected: () => {},
      },
    });
    const input = document.getElementById('dashboard-file-upload');
    expect(input).toBeDisabled();
  });

  it('calls onFilesSelected with selected files and clears input value', async () => {
    const onFilesSelected = vi.fn();
    const file = new File(['content'], 'workout.fit', { type: 'application/octet-stream' });
    render(DashboardUploadSection, {
      props: {
        isUploading: false,
        onFilesSelected,
      },
    });
    const input = document.getElementById('dashboard-file-upload') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    expect(onFilesSelected).toHaveBeenCalledTimes(1);
    expect(onFilesSelected).toHaveBeenCalledWith([file]);
    expect(input.value).toBe('');
  });

  it('does not call onFilesSelected when file input has no files', () => {
    const onFilesSelected = vi.fn();
    render(DashboardUploadSection, {
      props: {
        isUploading: false,
        onFilesSelected,
      },
    });
    const input = document.getElementById('dashboard-file-upload') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [] } });
    expect(onFilesSelected).not.toHaveBeenCalled();
  });

  it('shows DropZoneOverlay when isDraggingOver is true and not uploading', () => {
    render(DashboardUploadSection, {
      props: {
        isUploading: false,
        isDraggingOver: true,
        onFilesSelected: () => {},
      },
    });
    expect(screen.getByRole('dialog', { name: /drop files to upload/i })).toBeInTheDocument();
  });

  it('does not show overlay when isUploading even if isDraggingOver is true', () => {
    render(DashboardUploadSection, {
      props: {
        isUploading: true,
        isDraggingOver: true,
        onFilesSelected: () => {},
      },
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows overlay after dragenter with Files type', async () => {
    render(DashboardUploadSection, {
      props: {
        isUploading: false,
        onFilesSelected: () => {},
      },
    });
    const region = screen.getByRole('region', { name: 'Dashboard upload area' });
    region.dispatchEvent(createDragEvent('dragenter', { types: ['Files'] }));
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /drop files to upload/i })).toBeInTheDocument();
    });
  });

  it('hides overlay after dragleave when leaving region', async () => {
    render(DashboardUploadSection, {
      props: {
        isUploading: false,
        isDraggingOver: true,
        onFilesSelected: () => {},
      },
    });
    expect(screen.getByRole('dialog', { name: /drop files to upload/i })).toBeInTheDocument();
    const region = screen.getByRole('region', { name: 'Dashboard upload area' });
    region.dispatchEvent(createDragEvent('dragleave', { relatedTarget: null }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('calls onFilesSelected with dropped files and hides overlay on drop', async () => {
    const onFilesSelected = vi.fn();
    const file1 = new File(['a'], 'a.fit', { type: 'application/octet-stream' });
    const file2 = new File(['b'], 'b.tcx', { type: 'application/octet-stream' });
    render(DashboardUploadSection, {
      props: {
        isUploading: false,
        isDraggingOver: true,
        onFilesSelected,
      },
    });
    const region = screen.getByRole('region', { name: 'Dashboard upload area' });
    region.dispatchEvent(createDragEvent('drop', { files: [file1, file2] }));
    expect(onFilesSelected).toHaveBeenCalledWith([file1, file2]);
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('does not call onFilesSelected on drop when no files', () => {
    const onFilesSelected = vi.fn();
    render(DashboardUploadSection, {
      props: {
        isUploading: false,
        onFilesSelected,
      },
    });
    const region = screen.getByRole('region', { name: 'Dashboard upload area' });
    region.dispatchEvent(createDragEvent('drop', { types: [], files: [] }));
    expect(onFilesSelected).not.toHaveBeenCalled();
  });

  it('renders bulkBar snippet when provided', () => {
    render(DashboardUploadSectionWrapper, {
      props: {
        showBulkBar: true,
        isUploading: false,
        onFilesSelected: () => {},
      },
    });
    expect(screen.getByTestId('bulk-bar')).toBeInTheDocument();
    expect(screen.getByText('Bulk bar content')).toBeInTheDocument();
  });

  it('renders children snippet when provided', () => {
    render(DashboardUploadSectionWrapper, {
      props: {
        showChildren: true,
        isUploading: false,
        onFilesSelected: () => {},
      },
    });
    expect(screen.getByTestId('upload-children')).toBeInTheDocument();
    expect(screen.getByText('Children content')).toBeInTheDocument();
  });
});
