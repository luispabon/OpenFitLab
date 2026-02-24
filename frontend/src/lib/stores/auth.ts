// Auth store for managing current user session
// Use Svelte writable stores in plain TS modules
import { writable } from 'svelte/store';

export interface AuthUser {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export const user = writable<AuthUser | null>(null);
export const authChecked = writable(false);
export const authLoading = writable(true);

export async function checkAuth(): Promise<void> {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    if (res.ok) {
      const u = await res.json();
      user.set(u);
    } else {
      user.set(null);
    }
  } catch {
    user.set(null);
  } finally {
    authChecked.set(true);
    authLoading.set(false);
  }
}

export async function logout(): Promise<void> {
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  } finally {
    user.set(null);
  }
}

export function setCurrentUser(u: AuthUser | null) {
  user.set(u);
}
