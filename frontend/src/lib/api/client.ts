// Unified fetch wrapper that always includes credentials and handles 401/403
// Pass signal for request cancellation (e.g. when navigating away).
// Sends CSRF-Token header for state-changing methods (POST, PUT, PATCH, DELETE).
import { setCurrentUser, state as authState } from '../stores/auth.svelte';

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const method = (init.method ?? 'GET').toUpperCase();
  const headers = new Headers(init.headers);
  if (MUTATION_METHODS.has(method) && authState.csrfToken) {
    headers.set('CSRF-Token', authState.csrfToken);
  }
  const res = await fetch(input, { ...init, credentials: 'include', headers });
  if (res.status === 401) {
    setCurrentUser(null);
  }
  if (res.status === 403) {
    authState.csrfToken = null;
  }
  return res;
}

/** Throws if e is AbortError (expected when request is cancelled). */
export function isAbortError(e: unknown): boolean {
  return e instanceof DOMException && e.name === 'AbortError';
}
