/**
 * Tier 2: CSRF protection — DELETE /api/events/:id without CSRF-Token header → 403.
 * This is an API-level test with no browser involved.
 */
import { test, expect } from '../fixtures/auth.js';

test('DELETE without CSRF-Token returns 403', async ({ eventId, sessionCookie, apiBase }) => {
  const res = await fetch(`${apiBase}/api/events/${eventId}`, {
    method: 'DELETE',
    headers: {
      Cookie: `ofl.sid=${sessionCookie}`,
      // Deliberately omit CSRF-Token
    },
  });
  expect(res.status).toBe(403);
});

test('POST /api/events without CSRF-Token returns 403', async ({ sessionCookie, apiBase }) => {
  const formData = new FormData();
  formData.append('files', new Blob([''], { type: 'application/octet-stream' }), 'noop.tcx');
  const res = await fetch(`${apiBase}/api/events`, {
    method: 'POST',
    headers: {
      Cookie: `ofl.sid=${sessionCookie}`,
      // Deliberately omit CSRF-Token
    },
    body: formData,
  });
  expect(res.status).toBe(403);
});
