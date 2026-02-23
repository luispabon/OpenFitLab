import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import DropZoneOverlay from '../DropZoneOverlay.svelte';

describe('DropZoneOverlay', () => {
  it('renders overlay and text when visible', () => {
    render(DropZoneOverlay, { props: { visible: true } });
    const dialog = screen.getByRole('dialog', { name: /drop files to upload/i });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText('Drop files here to upload')).toBeInTheDocument();
  });

  it('shows supported formats text', () => {
    render(DropZoneOverlay, { props: { visible: true } });
    expect(screen.getByText(/Supported formats:.*TCX.*FIT.*GPX.*JSON.*SML/)).toBeInTheDocument();
  });

  it('renders nothing when not visible', () => {
    render(DropZoneOverlay, {
      props: { visible: false },
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
