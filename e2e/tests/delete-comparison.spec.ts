/**
 * Tier 2: Delete a comparison and verify it disappears from the list.
 */
import { test, expect } from '../fixtures/auth.js';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';

test('deleting a comparison removes it from the list', async ({
  page,
  csrfToken,
  sessionCookie,
  apiBase,
  activityId,
}) => {
  // Upload a second event to have two activities for a comparison
  const tcxBytes = readFileSync(resolve(__dirname, '../../backend/test/fixtures/minimal.tcx'));
  const formData = new FormData();
  formData.append(
    'files',
    new Blob([tcxBytes], { type: 'application/octet-stream' }),
    'for-comparison.tcx',
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
  expect(secondResult?.event).toBeDefined();
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

  // Create comparison via API
  const compRes = await fetch(`${apiBase}/api/comparisons`, {
    method: 'POST',
    headers: {
      Cookie: `ofl.sid=${sessionCookie}`,
      'CSRF-Token': csrfToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'E2E Delete Test',
      activityIds: [activityId, secondActivityId],
    }),
  });
  expect(compRes.ok).toBe(true);
  const compBody = (await compRes.json()) as { id: string };
  const comparisonId = compBody.id;

  // Navigate to comparisons list
  await page.goto('/#/comparisons');

  // The comparison should appear
  await expect(page.getByText('E2E Delete Test')).toBeVisible({ timeout: 15000 });

  // Click delete button for this comparison
  const deleteBtn = page
    .locator('li, tr, [data-testid]')
    .filter({ hasText: 'E2E Delete Test' })
    .getByRole('button', { name: /delete/i });
  await deleteBtn.click();

  // Confirm in dialog
  await page.getByRole('dialog').getByRole('button', { name: /delete/i }).click();

  // Comparison should be gone
  await expect(page.getByText('E2E Delete Test')).not.toBeVisible({ timeout: 10000 });

  // Clean up second event
  await fetch(`${apiBase}/api/events/${secondEventId}`, {
    method: 'DELETE',
    headers: {
      Cookie: `ofl.sid=${sessionCookie}`,
      'CSRF-Token': csrfToken,
    },
  });
});
