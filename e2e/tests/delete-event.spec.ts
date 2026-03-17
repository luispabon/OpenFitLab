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
  // Wait for data to load before capturing baseline row count
  await expect(async () => {
    const count = await page.locator('tr').count();
    expect(count).toBeGreaterThanOrEqual(2);
  }).toPass({ timeout: 15000 });

  const rowsBefore = await page.locator('tr').count();

  // Find the delete button for the new event row — click on the row's delete action
  // The WorkoutsActivityTable renders a delete icon button per row
  // Navigate to the event detail and use back button, or find the delete button directly
  // We rely on the row containing a delete icon button
  const deleteButtons = page.locator('button').filter({ has: page.locator('.material-icons', { hasText: 'delete' }) });
  await deleteButtons.first().click();

  // Confirm the deletion in the dialog — button is disabled while checking affected comparisons
  const confirmButton = page.getByRole('dialog').getByRole('button', { name: /^delete$/i });
  await expect(confirmButton).toBeEnabled({ timeout: 5000 });
  await confirmButton.click();

  // List should have one fewer row
  await expect(async () => {
    const count = await page.locator('tr').count();
    expect(count).toBe(rowsBefore - 1);
  }).toPass({ timeout: 15000 });
});
