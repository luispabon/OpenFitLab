// Unified fetch wrapper that always includes credentials and handles 401/403
// Pass signal for request cancellation (e.g. when navigating away).
// Sends CSRF-Token header for state-changing methods (POST, PUT, PATCH, DELETE).
// Concurrent GETs to the same URL share one network request (each caller receives a cloned Response).
import { setCurrentUser, state as authState } from '../stores/auth.svelte';

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** In-flight GET dedupe keyed by resolved request URL (string from input). */
const inFlightGet = new Map<string, Promise<Response>>();

function urlFromFetchInput(input: string | URL | Request): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  if (typeof Request !== 'undefined' && input instanceof Request) return input.url;
  return '';
}

function shouldCoalesceGet(
  input: string | URL | Request,
  method: string,
  init: RequestInit
): boolean {
  if (method !== 'GET') return false;
  if (init.signal) return false;
  if (init.body != null) return false;
  if (typeof Request !== 'undefined' && input instanceof Request && input.signal != null) {
    return false;
  }
  return Boolean(urlFromFetchInput(input));
}

export async function apiFetch(
  input: string | URL | Request,
  init: RequestInit = {}
): Promise<Response> {
  const method = (init.method ?? 'GET').toUpperCase();
  const headers = new Headers(init.headers);
  if (MUTATION_METHODS.has(method) && authState.csrfToken) {
    headers.set('CSRF-Token', authState.csrfToken);
  }

  const runFetch = async (): Promise<Response> => {
    const res = await fetch(input, { ...init, credentials: 'include', headers });
    if (res.status === 401) {
      const url = urlFromFetchInput(input);
      if (!url.includes('/api/integrations/')) {
        setCurrentUser(null);
      }
    }
    if (res.status === 403) {
      authState.csrfToken = null;
    }
    return res;
  };

  const key = shouldCoalesceGet(input, method, init) ? urlFromFetchInput(input) : null;
  if (key) {
    let shared = inFlightGet.get(key);
    if (!shared) {
      shared = runFetch().finally(() => {
        inFlightGet.delete(key);
      });
      inFlightGet.set(key, shared);
    }
    const res = await shared;
    // Tests may stub fetch with plain objects; real Responses support clone().
    return typeof res.clone === 'function' ? res.clone() : res;
  }

  return runFetch();
}

/** Apply auth-related side effects for non-`fetch()` requests (e.g. XHR uploads). */
export function handleAuthResponseStatus(status: number): void {
  if (status === 401) {
    setCurrentUser(null);
  }
  if (status === 403) {
    authState.csrfToken = null;
  }
}

/** Throws if e is AbortError (expected when request is cancelled). */
export function isAbortError(e: unknown): boolean {
  return e instanceof DOMException && e.name === 'AbortError';
}
