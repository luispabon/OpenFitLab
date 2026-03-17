/**
 * Tier 2: Deleting an event that is part of a comparison should also remove
 * that comparison from the comparisons list.
 */
import { test, expect } from '../fixtures/auth.js';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';

test('deleting an event removes its comparison', async ({
  page,
  csrfToken,
  sessionCookie,
  apiBase,
  activityId,
}) => {
  // Upload a second event
  const tcxBytes = readFileSync(resolve(__dirname, '../../backend/test/fixtures/minimal.tcx'));
  const formData = new FormData();
  formData.append(
    'files',
    new Blob([tcxBytes], { type: 'application/octet-stream' }),
    'linked.tcx',
  );

  const uploadRes = await fetch(`${apiBase}/api/events`, {
    method: 'POST',
    headers: {
      Cookie: `ofl.sid=${sessionCookie}`,
      'CSRF-Token': csrfToken,
    },
    body: formData,
  });
  expect(uploadRes.ok).toBe(true);

  const uploadBody = (await uploadRes.json()) as {
    results: Array<{ success: boolean; event?: { id: string } }>;
  };
  const secondResult = uploadBody.results.find((r) => r.success && r.event);
  const secondEventId = secondResult!.event!.id;

  // Fetch real activity ID from the event detail (upload response does not include DB UUIDs)
  const secondEventDetailRes = await fetch(`${apiBase}/api/events/${secondEventId}`, {
    headers: { Cookie: `ofl.sid=${sessionCookie}` },
  });
  expect(secondEventDetailRes.ok).toBe(true);
  const secondEventDetail = (await secondEventDetailRes.json()) as {
    activities: Array<{ id: string }>;
  };
  const secondActivityId = secondEventDetail.activities[0].id;

  // Create comparison linking both activities
  const compRes = await fetch(`${apiBase}/api/comparisons`, {
    method: 'POST',
    headers: {
      Cookie: `ofl.sid=${sessionCookie}`,
      'CSRF-Token': csrfToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'E2E Cascade Delete',
      activityIds: [activityId, secondActivityId],
    }),
  });
  expect(compRes.ok).toBe(true);

  // Delete the second event via API
  const deleteRes = await fetch(`${apiBase}/api/events/${secondEventId}`, {
    method: 'DELETE',
    headers: {
      Cookie: `ofl.sid=${sessionCookie}`,
      'CSRF-Token': csrfToken,
    },
  });
  expect(deleteRes.ok).toBe(true);

  // The comparison should be gone from the list
  await page.goto('/#/comparisons');
  await expect(page.getByText('E2E Cascade Delete')).not.toBeVisible({ timeout: 15000 });
});
