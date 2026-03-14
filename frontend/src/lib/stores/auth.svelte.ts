// Auth store for managing current user session (Svelte 5 runes)

function assertAuthResponse(data: unknown): asserts data is {
  csrfToken: string;
  id?: string;
  pendingSignup?: boolean;
  displayName?: string | null;
  avatarUrl?: string | null;
  profile?: { displayName?: string | null; avatarUrl?: string | null };
} {
  if (!data || typeof data !== 'object') throw new Error('Invalid auth response');
  const d = data as Record<string, unknown>;
  if (typeof d.csrfToken !== 'string') throw new Error('Invalid auth response: missing csrfToken');
}

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

export function urlHasSignupPending(): boolean {
  const hash = window.location.hash;
  return hash.includes('signup=pending') || hash.includes('signup-pending');
}

function applyAuthData(data: unknown) {
  assertAuthResponse(data);
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
      id: data.id ?? '',
      displayName: data.displayName ?? null,
      avatarUrl: data.avatarUrl ?? null,
    };
    state.csrfToken = data.csrfToken ?? null;
    state.pendingSignup = false;
    state.pendingProfile = null;
  }
}

export async function checkAuth(): Promise<void> {
  try {
    let res = await fetch('/api/auth/me', { credentials: 'include' });
    if (!res.ok && res.status === 401 && urlHasSignupPending()) {
      await new Promise((r) => setTimeout(r, 500));
      res = await fetch('/api/auth/me', { credentials: 'include' });
    }
    if (res.ok) {
      const data = await res.json();
      applyAuthData(data);
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
    const headers: HeadersInit = {};
    if (state.csrfToken) headers['CSRF-Token'] = state.csrfToken;
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
      headers,
    });
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
