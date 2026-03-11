import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import ExportButton from '../ExportButton.svelte';

describe('ExportButton', () => {
  it('renders a button with the download icon when idle', () => {
    render(ExportButton, { props: { onExport: vi.fn().mockResolvedValue(undefined) } });
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
    expect(button.querySelector('.material-icons')?.textContent).toBe('download');
  });

  it('has data-export-exclude attribute so it is omitted from captured images', () => {
    render(ExportButton, { props: { onExport: vi.fn().mockResolvedValue(undefined) } });
    expect(screen.getByRole('button')).toHaveAttribute('data-export-exclude');
  });

  it('uses the provided title attribute', () => {
    render(ExportButton, {
      props: { onExport: vi.fn().mockResolvedValue(undefined), title: 'Save image' },
    });
    expect(screen.getByTitle('Save image')).toBeInTheDocument();
  });

  it('defaults to "Export as PNG" title when none provided', () => {
    render(ExportButton, { props: { onExport: vi.fn().mockResolvedValue(undefined) } });
    expect(screen.getByTitle('Export as PNG')).toBeInTheDocument();
  });

  it('calls onExport when clicked', async () => {
    const onExport = vi.fn().mockResolvedValue(undefined);
    render(ExportButton, { props: { onExport } });
    await fireEvent.click(screen.getByRole('button'));
    expect(onExport).toHaveBeenCalledOnce();
  });

  it('disables the button and shows hourglass icon while onExport is in-flight', async () => {
    let resolve!: () => void;
    const onExport = vi.fn(
      () =>
        new Promise<void>((res) => {
          resolve = res;
        })
    );
    render(ExportButton, { props: { onExport } });
    const button = screen.getByRole('button');

    fireEvent.click(button);
    // Allow microtasks to run so exporting state is set
    await Promise.resolve();

    expect(button).toBeDisabled();
    expect(button.querySelector('.material-icons')?.textContent).toBe('hourglass_empty');

    resolve();
  });

  it('re-enables the button and restores download icon after onExport resolves', async () => {
    const onExport = vi.fn().mockResolvedValue(undefined);
    render(ExportButton, { props: { onExport } });
    const button = screen.getByRole('button');

    await fireEvent.click(button);
    // Wait for the async handler to finish
    await vi.waitFor(() => {
      expect(button).not.toBeDisabled();
    });
    expect(button.querySelector('.material-icons')?.textContent).toBe('download');
  });

  it('re-enables the button after onExport rejects and logs the error', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onExport = vi.fn().mockRejectedValue(new Error('export failed'));
    render(ExportButton, { props: { onExport } });
    const button = screen.getByRole('button');

    await fireEvent.click(button);
    await vi.waitFor(() => {
      expect(button).not.toBeDisabled();
    });
    expect(button.querySelector('.material-icons')?.textContent).toBe('download');
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[ExportButton]'),
      expect.any(Error)
    );
    consoleSpy.mockRestore();
  });

  it('does not call onExport again if clicked while already exporting', async () => {
    let resolve!: () => void;
    const onExport = vi.fn(
      () =>
        new Promise<void>((res) => {
          resolve = res;
        })
    );
    render(ExportButton, { props: { onExport } });
    const button = screen.getByRole('button');

    fireEvent.click(button);
    await Promise.resolve();

    // Button is disabled, a second click should not call onExport again
    await fireEvent.click(button);
    expect(onExport).toHaveBeenCalledOnce();

    resolve();
  });
});
