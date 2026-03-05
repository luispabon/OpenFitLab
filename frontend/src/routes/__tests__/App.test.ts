import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import App from '../../App.svelte';
import type { Writable } from 'svelte/store';

interface AuthUser {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
}

const { mockAuthState, mockCheckAuth } = vi.hoisted(() => {
  const mockAuthState = {
    user: null as AuthUser | null,
    authChecked: false,
    authLoading: true,
  };
  const mockCheckAuth = vi.fn();
  return { mockAuthState, mockCheckAuth };
});

vi.mock('../../lib/stores/auth.svelte', () => ({
  state: mockAuthState,
  checkAuth: (...args: unknown[]) => mockCheckAuth(...args),
  logout: vi.fn(),
  setCurrentUser: (u: AuthUser | null) => {
    mockAuthState.user = u;
  },
}));

// Router stub + location store; tests control location via globalThis
declare global {
  var __appTestLocationStore: Writable<string>;
}

vi.mock('svelte-spa-router', async () => {
  const { writable: w } = await import('svelte/store');
  const { default: AppRouterStub } = await import('./AppRouterStub.svelte');
  const loc = w('/');
  globalThis.__appTestLocationStore = loc;
  return {
    default: AppRouterStub,
    location: loc,
    push: vi.fn(),
    replace: vi.fn(),
  };
});

function getLocationStore() {
  return globalThis.__appTestLocationStore;
}

describe('App', () => {
  const storage: Record<string, string> = {};

  beforeEach(() => {
    mockCheckAuth.mockClear();
    mockAuthState.user = null;
    mockAuthState.authLoading = true;
    mockAuthState.authChecked = false;
    getLocationStore()?.set('/');
    storage['sidebarCollapsed'] = '';
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(
      (key: string) => storage[key] ?? null
    );
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key: string, value: string) => {
      storage[key] = value;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('auth state', () => {
    it('shows loading spinner in sidebar and main when auth is loading', async () => {
      mockAuthState.authLoading = true;
      mockAuthState.user = null;
      render(App);
      await waitFor(() => {
        const spinners = document.querySelectorAll('svg.animate-spin');
        expect(spinners.length).toBeGreaterThanOrEqual(1);
      });
      expect(screen.queryByText('Continue with Google')).not.toBeInTheDocument();
      expect(screen.queryByTestId('app-router')).not.toBeInTheDocument();
    });

    it('shows LoginPage when not authenticated', async () => {
      mockAuthState.authLoading = false;
      mockAuthState.user = null;
      render(App);
      await waitFor(() => {
        expect(screen.getByText('Continue with Google')).toBeInTheDocument();
      });
      expect(screen.getByText('Continue with GitHub')).toBeInTheDocument();
      expect(screen.getByTestId('app-router')).toBeInTheDocument();
      expect(document.querySelectorAll('svg.animate-spin').length).toBe(0);
    });

    it('shows Router and sidebar nav when authenticated', async () => {
      mockAuthState.authLoading = false;
      mockAuthState.user = { id: 'u1', displayName: 'Test User', avatarUrl: null };
      render(App);
      await waitFor(() => {
        expect(screen.getByTestId('app-router')).toBeInTheDocument();
      });
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Comparisons')).toBeInTheDocument();
      expect(screen.getByText('Test User')).toBeInTheDocument();
      expect(document.querySelectorAll('svg.animate-spin').length).toBe(0);
    });

    it('calls checkAuth on mount', async () => {
      render(App);
      await waitFor(() => {
        expect(mockCheckAuth).toHaveBeenCalled();
      });
    });
  });

  describe('sidebar collapse and localStorage', () => {
    beforeEach(() => {
      mockAuthState.authLoading = false;
      mockAuthState.user = { id: 'u1', displayName: 'Test User', avatarUrl: null };
    });

    it('shows sidebar expanded by default with OpenFitLab and Collapse button', async () => {
      render(App);
      await waitFor(() => {
        expect(screen.getByText('OpenFitLab')).toBeInTheDocument();
      });
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Comparisons')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Collapse sidebar' })).toBeInTheDocument();
      const nav = document.querySelector('nav');
      expect(nav).toHaveStyle({ width: '16rem' });
    });

    it('shows sidebar collapsed when localStorage has sidebarCollapsed true', async () => {
      storage['sidebarCollapsed'] = 'true';
      render(App);
      await waitFor(() => {
        expect(screen.queryByText('OpenFitLab')).not.toBeInTheDocument();
      });
      expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
      expect(screen.queryByText('Comparisons')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument();
      const nav = document.querySelector('nav');
      expect(nav).toHaveStyle({ width: '4rem' });
    });

    it('toggles sidebar when collapse button is clicked', async () => {
      render(App);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Collapse sidebar' })).toBeInTheDocument();
      });
      const button = screen.getByRole('button', { name: 'Collapse sidebar' });
      await fireEvent.click(button);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument();
      });
      await fireEvent.click(screen.getByRole('button', { name: 'Expand sidebar' }));
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Collapse sidebar' })).toBeInTheDocument();
      });
    });

    it('saves sidebar state to localStorage on toggle', async () => {
      const setItem = vi.spyOn(Storage.prototype, 'setItem');
      render(App);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Collapse sidebar' })).toBeInTheDocument();
      });
      await fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
      expect(setItem).toHaveBeenCalledWith('sidebarCollapsed', 'true');
      await fireEvent.click(screen.getByRole('button', { name: 'Expand sidebar' }));
      expect(setItem).toHaveBeenCalledWith('sidebarCollapsed', 'false');
    });

    it('shows sidebar expanded when localStorage has sidebarCollapsed false', async () => {
      storage['sidebarCollapsed'] = 'false';
      render(App);
      await waitFor(() => {
        expect(screen.getByText('OpenFitLab')).toBeInTheDocument();
      });
      expect(screen.getByRole('button', { name: 'Collapse sidebar' })).toBeInTheDocument();
    });
  });

  describe('route and nav active state', () => {
    beforeEach(() => {
      mockAuthState.authLoading = false;
      mockAuthState.user = { id: 'u1', displayName: 'Test User', avatarUrl: null };
    });

    it('highlights Dashboard link when location is /', async () => {
      getLocationStore().set('/');
      render(App);
      await waitFor(() => {
        expect(screen.getByTestId('app-router')).toBeInTheDocument();
      });
      const dashboardLink = screen.getByRole('link', { name: /dashboard/i });
      expect(dashboardLink).toHaveClass('border-accent');
      const comparisonsLink = screen.getByRole('link', { name: /comparisons/i });
      expect(comparisonsLink).not.toHaveClass('border-accent');
    });

    it('highlights Comparisons link when location starts with /comparisons', async () => {
      getLocationStore().set('/comparisons');
      render(App);
      await waitFor(() => {
        expect(screen.getByTestId('app-router')).toBeInTheDocument();
      });
      const comparisonsLink = screen.getByRole('link', { name: /comparisons/i });
      expect(comparisonsLink).toHaveClass('border-accent');
      const dashboardLink = screen.getByRole('link', { name: /dashboard/i });
      expect(dashboardLink).not.toHaveClass('border-accent');
    });

    it('highlights neither link when location is /account', async () => {
      getLocationStore().set('/account');
      render(App);
      await waitFor(() => {
        expect(screen.getByTestId('app-router')).toBeInTheDocument();
      });
      const dashboardLink = screen.getByRole('link', { name: /dashboard/i });
      const comparisonsLink = screen.getByRole('link', { name: /comparisons/i });
      expect(dashboardLink).not.toHaveClass('border-accent');
      expect(comparisonsLink).not.toHaveClass('border-accent');
    });

    it('updates nav active state when location changes', async () => {
      getLocationStore().set('/');
      render(App);
      await waitFor(() => {
        expect(screen.getByRole('link', { name: /dashboard/i })).toHaveClass('border-accent');
      });
      getLocationStore().set('/comparisons');
      await waitFor(() => {
        expect(screen.getByRole('link', { name: /comparisons/i })).toHaveClass('border-accent');
        expect(screen.getByRole('link', { name: /dashboard/i })).not.toHaveClass('border-accent');
      });
    });
  });

  describe('UserMenu', () => {
    beforeEach(() => {
      mockAuthState.authLoading = false;
    });

    it('shows UserMenu with displayName when authenticated', async () => {
      mockAuthState.user = { id: 'u1', displayName: 'Alice', avatarUrl: null };
      render(App);
      await waitFor(() => {
        expect(screen.getByText('Alice')).toBeInTheDocument();
      });
      expect(screen.getByRole('button', { name: 'Account' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Logout' })).toBeInTheDocument();
    });

    it('shows UserMenu when displayName is null (initials fallback)', async () => {
      mockAuthState.user = { id: 'u2', displayName: null, avatarUrl: null };
      render(App);
      await waitFor(() => {
        expect(screen.getByTestId('app-router')).toBeInTheDocument();
      });
      expect(screen.getByText('User')).toBeInTheDocument();
    });

    it('passes avatarUrl to UserMenu when set', async () => {
      mockAuthState.user = {
        id: 'u3',
        displayName: 'Bob',
        avatarUrl: 'https://example.com/avatar.png',
      };
      render(App);
      await waitFor(() => {
        const img = document.querySelector('img[alt="avatar"]');
        expect(img).toBeInTheDocument();
        expect(img).toHaveAttribute('src', 'https://example.com/avatar.png');
      });
    });
  });
});
