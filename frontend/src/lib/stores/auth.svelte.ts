// Auth store for managing current user session (Svelte 5 runes)
export interface AuthUser {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface PendingProfile {
  displayName: string | null;
  avatarUrl: string | null;
}

// Single state object: only mutate properties so it can be exported
export const state = $state({
  user: null as AuthUser | null,
  csrfToken: null as string | null,
  authChecked: false,
  authLoading: true,
  pendingSignup: false,
  pendingProfile: null as PendingProfile | null,
});

export async function checkAuth(): Promise<void> {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();

      if (data.pendingSignup) {
        state.pendingSignup = true;
        state.pendingProfile = {
          displayName: data.profile?.displayName ?? null,
          avatarUrl: data.profile?.avatarUrl ?? null,
        };
        state.user = null;
        state.csrfToken = data.csrfToken ?? null;
      } else {
        state.user = {
          id: data.id,
          displayName: data.displayName ?? null,
          avatarUrl: data.avatarUrl ?? null,
        };
        state.csrfToken = data.csrfToken ?? null;
        state.pendingSignup = false;
        state.pendingProfile = null;
      }
    } else {
      state.user = null;
      state.csrfToken = null;
      state.pendingSignup = false;
      state.pendingProfile = null;
    }
  } catch {
    state.user = null;
    state.csrfToken = null;
    state.pendingSignup = false;
    state.pendingProfile = null;
  } finally {
    state.authChecked = true;
    state.authLoading = false;
  }
}

export async function logout(): Promise<void> {
  try {
    const { apiFetch } = await import('../api/client');
    await apiFetch('/api/auth/logout', { method: 'POST' });
  } finally {
    state.user = null;
    state.csrfToken = null;
    state.pendingSignup = false;
    state.pendingProfile = null;
  }
}

export function setCurrentUser(u: AuthUser | null) {
  state.user = u;
  if (!u) {
    state.csrfToken = null;
    state.pendingSignup = false;
    state.pendingProfile = null;
  }
}
