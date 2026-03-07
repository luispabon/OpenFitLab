import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/svelte';
import TermsAcceptance from '../terms-acceptance.svelte';

const { mockCompleteSignup, mockDeclineSignup, mockCheckAuth, mockPush, mockAuthState } =
  vi.hoisted(() => {
    return {
      mockCompleteSignup: vi.fn(),
      mockDeclineSignup: vi.fn(),
      mockCheckAuth: vi.fn(),
      mockPush: vi.fn(),
      mockAuthState: {
        user: null as { id: string; displayName: string | null; avatarUrl: string | null } | null,
        pendingSignup: true,
        pendingProfile: { displayName: 'Test User', avatarUrl: null } as {
          displayName: string | null;
          avatarUrl: string | null;
        } | null,
      },
    };
  });

vi.mock('../../lib/api/auth', () => ({
  completeSignup: () => mockCompleteSignup(),
  declineSignup: () => mockDeclineSignup(),
}));

vi.mock('../../lib/stores/auth.svelte', () => ({
  state: mockAuthState,
  checkAuth: (...args: unknown[]) => mockCheckAuth(...args),
}));

vi.mock('svelte-spa-router', () => ({
  push: (path: string) => mockPush(path),
}));

describe('TermsAcceptance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState.pendingSignup = true;
    mockAuthState.pendingProfile = { displayName: 'Test User', avatarUrl: null };
  });

  it('renders welcome and Privacy Policy button', () => {
    render(TermsAcceptance);
    expect(screen.getByText('Welcome to OpenFitLab')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Privacy Policy' })).toBeInTheDocument();
  });

  it('opens privacy modal when Privacy Policy button is clicked', async () => {
    render(TermsAcceptance);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: 'Privacy Policy' }));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog.querySelector('#privacy-modal-title')).toHaveTextContent('Privacy Policy');
    expect(within(dialog).getByText(/Data Controller:/)).toBeInTheDocument();
  });

  it('closes modal when Close button is clicked', async () => {
    render(TermsAcceptance);
    await fireEvent.click(screen.getByRole('button', { name: 'Privacy Policy' }));
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    await fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('closes modal on Escape key', async () => {
    render(TermsAcceptance);
    await fireEvent.click(screen.getByRole('button', { name: 'Privacy Policy' }));
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const dialog = screen.getByRole('dialog');
    await fireEvent.keyDown(dialog, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
