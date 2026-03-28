/**
 * Delete event test — uploads a fresh event, deletes it via the UI, and
 * verifies it disappears from the list.
 */
import { test, expect } from '../fixtures/auth.js';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';

test('deleting an event removes it from the list', async ({
  page,
  csrfToken,
  sessionCookie,
  apiBase,
}) => {
  // Upload a throwaway event via API
  const tcxBytes = readFileSync(resolve(__dirname, '../../backend/test/fixtures/minimal.tcx'));
  const formData = new FormData();
  formData.append(
    'files',
    new Blob([tcxBytes], { type: 'application/octet-stream' }),
    'to-delete.tcx',
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
  const newEventId = uploadBody.results.find((r) => r.success && r.event)?.event?.id;
  expect(newEventId).toBeDefined();

  // Navigate to workouts
  await page.goto('/');
  await expect(page.getByRole('table')).toBeVisible({ timeout: 15000 });

  // Wait for the specific 'to-delete' row to appear. Other parallel tests may also
  // have rows in the table; targeting by name avoids accidentally deleting the
  // shared seeded event.
  const targetRow = page.locator('tr').filter({ hasText: 'to-delete' });
  await expect(targetRow).toBeVisible({ timeout: 15000 });

  // Delete only the row for the event this test uploaded
  await targetRow.getByRole('button', { name: /delete/i }).click();

  // Confirm the deletion in the dialog — button is disabled while checking affected comparisons
  const confirmButton = page.getByRole('dialog').getByRole('button', { name: /^delete$/i });
  await expect(confirmButton).toBeEnabled({ timeout: 5000 });
  await confirmButton.click();

  // That row should disappear (assert on this row, not total count — parallel tests
  // add/remove other rows in the same table).
  await expect(targetRow).not.toBeVisible({ timeout: 15000 });
});
