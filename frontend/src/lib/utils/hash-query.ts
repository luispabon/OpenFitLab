/**
 * Parses a single query parameter value from a URL hash string.
 * Handles both "?key=value" and "&key=value" forms.
 * Returns null if the key is absent or the value is empty.
 */
export function parseHashParam(hash: string, key: string): string | null {
  const match = hash.match(new RegExp(`[?&]${key}=([^&]*)`));
  const value = match?.[1] ? decodeURIComponent(match[1]).trim() : null;
  return value || null;
}
