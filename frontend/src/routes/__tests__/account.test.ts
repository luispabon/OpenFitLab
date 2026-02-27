import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import Account from '../account.svelte';

const mockDeleteAccount = vi.fn();
const mockSetCurrentUser = vi.fn();
const mockPush = vi.fn();

vi.mock('../../lib/api', () => ({
  deleteAccount: (...args: unknown[]) => mockDeleteAccount(...args),
}));

vi.mock('../../lib/stores/auth', () => ({
  setCurrentUser: (...args: unknown[]) => mockSetCurrentUser(...args),
}));

vi.mock('svelte-spa-router', () => ({
  push: (...args: unknown[]) => mockPush(...args),
}));

describe('Account', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders static content', () => {
    render(Account);
    expect(screen.getByRole('heading', { name: 'Account' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Delete my account' })).toBeInTheDocument();
    expect(
      screen.getByText('This page is for account deletion only. Data export may be added later.')
    ).toBeInTheDocument();
    expect(
      screen.getByText(/I understand that all my data will be permanently deleted/)
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText('DELETE')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Permanently delete my account' })).toBeInTheDocument();
  });

  it('disables delete button until checkbox checked and confirm text is DELETE', async () => {
    render(Account);
    const button = screen.getByRole('button', { name: 'Permanently delete my account' });
    expect(button).toBeDisabled();

    fireEvent.click(screen.getByRole('checkbox', { name: /I understand/ }));
    expect(button).toBeDisabled();

    const input = screen.getByPlaceholderText('DELETE');
    fireEvent.input(input, { target: { value: 'DEL' } });
    expect(button).toBeDisabled();

    fireEvent.input(input, { target: { value: 'DELETE' } });
    await waitFor(() => {
      expect(button).not.toBeDisabled();
    });
  });

  it('on success calls setCurrentUser(null) and push("/")', async () => {
    mockDeleteAccount.mockResolvedValue({ ok: true });
    render(Account);
    fireEvent.click(screen.getByRole('checkbox', { name: /I understand/ }));
    fireEvent.input(screen.getByPlaceholderText('DELETE'), { target: { value: 'DELETE' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Permanently delete my account' }));

    await waitFor(() => {
      expect(mockDeleteAccount).toHaveBeenCalledTimes(1);
    });
    expect(mockSetCurrentUser).toHaveBeenCalledWith(null);
    expect(mockPush).toHaveBeenCalledWith('/');
  });

  it('on error displays result.error and resets isDeleting', async () => {
    mockDeleteAccount.mockResolvedValue({ ok: false, status: 500, error: 'Server error' });
    render(Account);
    fireEvent.click(screen.getByRole('checkbox', { name: /I understand/ }));
    fireEvent.input(screen.getByPlaceholderText('DELETE'), { target: { value: 'DELETE' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Permanently delete my account' }));

    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeInTheDocument();
    });
    expect(mockSetCurrentUser).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Permanently delete my account' })).not.toBeDisabled();
  });

  it('on error without error message shows fallback text', async () => {
    mockDeleteAccount.mockResolvedValue({ ok: false, status: 500 });
    render(Account);
    fireEvent.click(screen.getByRole('checkbox', { name: /I understand/ }));
    fireEvent.input(screen.getByPlaceholderText('DELETE'), { target: { value: 'DELETE' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Permanently delete my account' }));

    await waitFor(() => {
      expect(screen.getByText('Something went wrong. Please try again.')).toBeInTheDocument();
    });
  });

  it('shows loading state while deleting', async () => {
    const holder: { resolve: (value: { ok: true }) => void } = { resolve: () => {} };
    mockDeleteAccount.mockImplementation(
      () => new Promise((resolve) => { holder.resolve = resolve; })
    );
    render(Account);
    fireEvent.click(screen.getByRole('checkbox', { name: /I understand/ }));
    fireEvent.input(screen.getByPlaceholderText('DELETE'), { target: { value: 'DELETE' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Permanently delete my account' }));

    await waitFor(() => {
      expect(screen.getByText('Deleting…')).toBeInTheDocument();
    });
    expect(screen.getByRole('button')).toBeDisabled();
    expect(screen.getByRole('checkbox')).toBeDisabled();

    holder.resolve({ ok: true });
  });

  it('does not call deleteAccount when button clicked without canDelete', () => {
    render(Account);
    fireEvent.click(screen.getByRole('button', { name: 'Permanently delete my account' }));
    expect(mockDeleteAccount).not.toHaveBeenCalled();
  });
});
