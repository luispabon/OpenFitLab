import { apiFetch } from './client';

const API_BASE = '/api/auth';

export type LoginProviders = {
  google: boolean;
  github: boolean;
  apple: boolean;
  facebook: boolean;
};

/**
 * Fetch which OAuth login providers are enabled (public capability endpoint).
 * Returns null when the request fails so callers keep provider buttons hidden.
 */
export async function fetchLoginProviders(): Promise<LoginProviders | null> {
  try {
    const res = await apiFetch(`${API_BASE}/providers`);
    if (!res.ok) return null;
    const data = (await res.json()) as Partial<Record<keyof LoginProviders, unknown>>;
    return {
      google: data.google === true,
      github: data.github === true,
      apple: data.apple === true,
      facebook: data.facebook === true,
    };
  } catch {
    return null;
  }
}

export type CompleteSignupResult =
  | {
      ok: true;
      user: { id: string; displayName: string | null; avatarUrl: string | null };
      csrfToken: string;
    }
  | { ok: false; status: number; error?: string };

export type DeclineSignupResult = { ok: true } | { ok: false; status: number; error?: string };

/**
 * Complete signup by accepting Terms of Service.
 * Creates the user account and returns the authenticated user.
 */
export async function completeSignup(): Promise<CompleteSignupResult> {
  const res = await apiFetch(`${API_BASE}/complete-signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (res.ok) {
    const data = await res.json();
    return {
      ok: true,
      user: {
        id: data.id,
        displayName: data.displayName ?? null,
        avatarUrl: data.avatarUrl ?? null,
      },
      csrfToken: data.csrfToken ?? '',
    };
  }

  let error: string | undefined;
  const text = await res.text();
  if (text) {
    try {
      const json = JSON.parse(text) as { error?: string };
      if (typeof json.error === 'string') error = json.error;
    } catch {
      error = res.statusText || 'Request failed';
    }
  } else {
    error = res.statusText || 'Request failed';
  }

  return { ok: false, status: res.status, error };
}

/**
 * Decline Terms of Service and cancel signup.
 * Destroys the pending session.
 */
export async function declineSignup(): Promise<DeclineSignupResult> {
  const res = await apiFetch(`${API_BASE}/decline-signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (res.ok) {
    return { ok: true };
  }

  let error: string | undefined;
  const text = await res.text();
  if (text) {
    try {
      const json = JSON.parse(text) as { error?: string };
      if (typeof json.error === 'string') error = json.error;
    } catch {
      error = res.statusText || 'Request failed';
    }
  } else {
    error = res.statusText || 'Request failed';
  }

  return { ok: false, status: res.status, error };
}
