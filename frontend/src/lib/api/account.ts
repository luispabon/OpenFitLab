import { apiFetch } from './client';

const API_BASE = '/api';

export type DeleteAccountResult = { ok: true } | { ok: false; status: number; error?: string };

const ANALYTICS_ENABLED_KEY = 'analytics_enabled';

/**
 * Get the user's analytics opt-out preference from localStorage.
 * Returns true if analytics is allowed, false if opted out. Default true when unset.
 */
export function getAnalyticsEnabled(): boolean {
  if (typeof localStorage === 'undefined') return true;
  const stored = localStorage.getItem(ANALYTICS_ENABLED_KEY);
  if (stored === null) return true;
  return stored !== 'false';
}

/**
 * Set the user's analytics preference. Call after user toggles in Account > Privacy.
 */
export function setAnalyticsEnabled(enabled: boolean): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(ANALYTICS_ENABLED_KEY, String(enabled));
}

/**
 * Export all user data as JSON. Optionally include stream time-series data.
 * Returns the response JSON; caller can trigger a file download.
 */
export async function exportUserData(includeStreams = false): Promise<
  | {
      ok: true;
      data: unknown;
    }
  | { ok: false; status: number; error?: string }
> {
  const url = `${API_BASE}/account/export${includeStreams ? '?includeStreams=true' : ''}`;
  const res = await apiFetch(url);

  if (!res.ok) {
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

  const data = await res.json();
  return { ok: true, data };
}

/**
 * Delete the current user's account and all associated data.
 * On 204, returns { ok: true }. Caller should clear auth state and redirect.
 * On 4xx/5xx, returns { ok: false, status, error? }. Does not clear auth state.
 * 401 is handled by apiFetch (auth state cleared); this function still returns { ok: false, status: 401 }.
 */
export async function deleteAccount(): Promise<DeleteAccountResult> {
  const res = await apiFetch(`${API_BASE}/account`, { method: 'DELETE' });

  if (res.status === 204) {
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
