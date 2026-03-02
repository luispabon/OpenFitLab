// Unified fetch wrapper that always includes credentials and handles 401
// Pass signal for request cancellation (e.g. when navigating away).
import { setCurrentUser } from '../stores/auth.svelte';

export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(input, { ...init, credentials: 'include' });
  if (res.status === 401) {
    // Session expired or unauthenticated
    setCurrentUser(null);
  }
  return res;
}

/** Throws if e is AbortError (expected when request is cancelled). */
export function isAbortError(e: unknown): boolean {
  return e instanceof DOMException && e.name === 'AbortError';
}
