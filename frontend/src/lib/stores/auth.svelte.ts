// Auth store for managing current user session (Svelte 5 runes)
export interface AuthUser {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
}

// Single state object: only mutate properties so it can be exported
export const state = $state({
  user: null as AuthUser | null,
  authChecked: false,
  authLoading: true,
});

export async function checkAuth(): Promise<void> {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    if (res.ok) {
      const u = await res.json();
      state.user = u;
    } else {
      state.user = null;
    }
  } catch {
    state.user = null;
  } finally {
    state.authChecked = true;
    state.authLoading = false;
  }
}

export async function logout(): Promise<void> {
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  } finally {
    state.user = null;
  }
}

export function setCurrentUser(u: AuthUser | null) {
  state.user = u;
}
