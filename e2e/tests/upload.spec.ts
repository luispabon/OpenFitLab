/**
 * File upload tests — upload minimal.tcx via the file input and verify the
 * event appears in the activity list.
 */
import { test, expect } from '../fixtures/auth.js';
import { resolve } from 'node:path';

test('uploading a TCX file creates an event visible in the list', async ({ page }) => {
  await page.goto('/');

  // Wait for the initial load to settle
  await expect(page.getByRole('table')).toBeVisible({ timeout: 15000 });

  // Register listeners before triggering the upload so we don't miss responses
  const uploadResponsePromise = page.waitForResponse(
    (res) => res.url().includes('/api/events') && res.request().method() === 'POST',
    { timeout: 30000 },
  );
  // The app reloads the activity list after a successful upload via GET /api/events/activity-rows
  const listRefreshPromise = page.waitForResponse(
    (res) => res.url().includes('/api/events/activity-rows') && res.request().method() === 'GET',
    { timeout: 30000 },
  );

  // Locate the hidden file input inside the upload section and trigger the upload
  await page.locator('input[type="file"]').setInputFiles(
    resolve(__dirname, '../../backend/test/fixtures/minimal.tcx'),
  );

  // Verify the upload API call succeeded and returned a new event ID
  const uploadResponse = await uploadResponsePromise;
  expect(uploadResponse.ok()).toBe(true);
  const uploadBody = (await uploadResponse.json()) as {
    results: Array<{ success: boolean; event?: { id: string } }>;
  };
  const newEventId = uploadBody.results.find((r) => r.success && r.event)?.event?.id;
  expect(newEventId).toBeDefined();

  // Verify the subsequent list refresh includes the newly uploaded event
  const listResponse = await listRefreshPromise;
  expect(listResponse.ok()).toBe(true);
  const listBody = (await listResponse.json()) as {
    rows: Array<{ event: { id: string } }>;
    total: number;
  };
  expect(listBody.rows.some((r) => r.event.id === newEventId)).toBe(true);
});
