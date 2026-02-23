import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import ConfirmDialog from '../dashboard/ConfirmDialog.svelte';

describe('ConfirmDialog', () => {
  const defaultProps = {
    title: 'Delete?',
    message: 'Are you sure?',
    confirmLabel: 'Yes',
    onConfirm: () => {},
    onCancel: () => {},
  };

  it('renders title and message', () => {
    render(ConfirmDialog, { props: defaultProps });
    expect(screen.getByText('Delete?')).toBeInTheDocument();
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
  });

  it('shows confirm button with confirmLabel', () => {
    render(ConfirmDialog, { props: defaultProps });
    expect(screen.getByRole('button', { name: 'Yes' })).toBeInTheDocument();
  });

  it('shows default cancel label', () => {
    render(ConfirmDialog, { props: defaultProps });
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('shows custom cancel label when provided', () => {
    render(ConfirmDialog, {
      props: { ...defaultProps, cancelLabel: 'Nope' },
    });
    expect(screen.getByRole('button', { name: 'Nope' })).toBeInTheDocument();
  });

  it('shows loadingLabel when loading', () => {
    render(ConfirmDialog, {
      props: {
        ...defaultProps,
        loading: true,
        loadingLabel: 'Working...',
      },
    });
    expect(screen.getByRole('button', { name: 'Working...' })).toBeInTheDocument();
  });

  it('shows default loading label when loading', () => {
    render(ConfirmDialog, {
      props: { ...defaultProps, loading: true },
    });
    expect(screen.getByRole('button', { name: 'Deleting...' })).toBeInTheDocument();
  });

  it('calls onConfirm when confirm button clicked', async () => {
    const onConfirm = vi.fn();
    render(ConfirmDialog, {
      props: { ...defaultProps, onConfirm },
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when cancel button clicked', async () => {
    const onCancel = vi.fn();
    render(ConfirmDialog, {
      props: { ...defaultProps, onCancel },
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('has role="dialog" and aria-modal="true"', () => {
    render(ConfirmDialog, { props: defaultProps });
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('confirm button has danger class when danger is true', () => {
    render(ConfirmDialog, {
      props: { ...defaultProps, danger: true },
    });
    const confirmBtn = screen.getByRole('button', { name: 'Yes' });
    expect(confirmBtn).toHaveClass('bg-danger');
  });

  it('both buttons are disabled when confirmDisabled is true', () => {
    render(ConfirmDialog, {
      props: { ...defaultProps, confirmDisabled: true },
    });
    expect(screen.getByRole('button', { name: 'Yes' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });

  it('shows warning box with warningMessage when provided', () => {
    render(ConfirmDialog, {
      props: {
        ...defaultProps,
        warningMessage: 'This will also delete 2 comparisons: Run A, Run B.',
      },
    });
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('This will also delete 2 comparisons: Run A, Run B.');
    expect(alert).toHaveTextContent('warning');
  });

  it('does not show warning box when warningMessage is undefined', () => {
    render(ConfirmDialog, { props: defaultProps });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
