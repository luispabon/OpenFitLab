import { apiFetch } from './client';

const API_BASE = '/api';

export type DeleteAccountResult = { ok: true } | { ok: false; status: number; error?: string };

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
