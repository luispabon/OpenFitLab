// Unified fetch wrapper that always includes credentials and handles 401
import { setCurrentUser } from '../stores/auth';

export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(input, { ...init, credentials: 'include' });
  if (res.status === 401) {
    // Session expired or unauthenticated
    setCurrentUser(null);
  }
  return res;
}
