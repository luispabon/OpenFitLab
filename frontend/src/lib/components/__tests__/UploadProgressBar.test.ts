import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import UploadProgressBar from '../UploadProgressBar.svelte';

describe('UploadProgressBar', () => {
  it('shows file counter', () => {
    render(UploadProgressBar, {
      props: {
        currentFile: 2,
        totalFiles: 5,
        progress: 50,
      },
    });
    expect(screen.getByText(/2 of 5/)).toBeInTheDocument();
  });

  it('shows percentage rounded', () => {
    render(UploadProgressBar, {
      props: {
        currentFile: 1,
        totalFiles: 1,
        progress: 73.6,
      },
    });
    expect(screen.getByText('74%')).toBeInTheDocument();
  });

  it('shows filename when provided', () => {
    render(UploadProgressBar, {
      props: {
        currentFile: 1,
        totalFiles: 1,
        progress: 0,
        fileName: 'run.fit',
      },
    });
    expect(screen.getByText('run.fit')).toBeInTheDocument();
  });

  it('does not show filename when not provided', () => {
    render(UploadProgressBar, {
      props: {
        currentFile: 1,
        totalFiles: 1,
        progress: 0,
      },
    });
    expect(screen.queryByText(/\.fit/)).not.toBeInTheDocument();
  });

  it('shows custom label', () => {
    render(UploadProgressBar, {
      props: {
        currentFile: 1,
        totalFiles: 1,
        progress: 0,
        label: 'Processing file',
      },
    });
    expect(screen.getByText(/Processing file/)).toBeInTheDocument();
  });

  it('has progressbar role with aria-valuenow', () => {
    render(UploadProgressBar, {
      props: {
        currentFile: 1,
        totalFiles: 1,
        progress: 42,
      },
    });
    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-valuenow', '42');
  });
});
