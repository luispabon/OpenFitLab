// Auth store for managing current user session (Svelte 5 runes)
export interface AuthUser {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
}

// Single state object: only mutate properties so it can be exported
export const state = $state({
  user: null as AuthUser | null,
  csrfToken: null as string | null,
  authChecked: false,
  authLoading: true,
});

export async function checkAuth(): Promise<void> {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    if (res.ok) {
      const u = await res.json();
      state.user = {
        id: u.id,
        displayName: u.displayName ?? null,
        avatarUrl: u.avatarUrl ?? null,
      };
      state.csrfToken = u.csrfToken ?? null;
    } else {
      state.user = null;
      state.csrfToken = null;
    }
  } catch {
    state.user = null;
    state.csrfToken = null;
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
  }
}

export function setCurrentUser(u: AuthUser | null) {
  state.user = u;
  if (!u) state.csrfToken = null;
}
