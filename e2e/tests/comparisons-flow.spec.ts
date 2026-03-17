/**
 * Comparisons flow: upload a second event, select 2 activities, create a
 * comparison, save it, then open the saved comparison view.
 */
import { test, expect } from '../fixtures/auth.js';
import { resolve } from 'node:path';

test('can create and view a saved comparison', async ({ page, csrfToken, sessionCookie, apiBase }) => {
  // Upload a second event via API (faster than UI)
  const tcxPath = resolve(__dirname, '../../backend/test/fixtures/minimal.tcx');
  const { readFileSync } = await import('node:fs');
  const tcxBytes = readFileSync(tcxPath);

  const formData = new FormData();
  formData.append('files', new Blob([tcxBytes], { type: 'application/octet-stream' }), 'minimal2.tcx');

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
    results: Array<{ success: boolean; event?: { id: string; activities: Array<{ id: string }> } }>;
  };
  const secondEvent = uploadBody.results.find((r) => r.success && r.event)?.event;
  expect(secondEvent).toBeDefined();

  const secondEventId = secondEvent!.id;

  // Navigate to workouts list
  await page.goto('/');
  await expect(page.getByRole('table')).toBeVisible({ timeout: 15000 });
  // Wait for data rows and their checkboxes to appear
  await expect(async () => {
    const count = await page.locator('input[type="checkbox"]').count();
    expect(count).toBeGreaterThanOrEqual(2);
  }).toPass({ timeout: 15000 });

  // Select both events via checkboxes
  const checkboxes = page.locator('input[type="checkbox"]');
  const checkboxCount = await checkboxes.count();
  // Select up to 2 event checkboxes (skip select-all which may be index 0)
  let selected = 0;
  for (let i = 0; i < checkboxCount && selected < 2; i++) {
    const cb = checkboxes.nth(i);
    const isSelectAll = await cb.evaluate((el) => el.closest('thead') !== null);
    if (!isSelectAll) {
      await cb.check();
      selected++;
    }
  }
  expect(selected).toBe(2);

  // Click Compare in the bulk action bar
  await page.getByRole('button', { name: /compare/i }).click();

  // Should navigate to /compare/new
  await expect(page).toHaveURL(/#\/compare\/new/, { timeout: 10000 });

  // Open the save dialog — button only renders once events have loaded
  await expect(page.getByRole('button', { name: /save comparison/i })).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: /save comparison/i }).click();

  // Wait for the dialog and confirm save
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
  await page.getByRole('dialog').getByRole('button', { name: /^save$/i }).click();

  // After saving, should navigate to a saved comparison URL /compare/<uuid>
  await expect(page).toHaveURL(/#\/compare\/[a-f0-9-]+/, { timeout: 15000 });

  // The comparison view should load
  await expect(page.locator('main, section').first()).toBeVisible();

  // Navigate to comparisons list and verify it's there
  await page.goto('/#/comparisons');
  // The comparisons list should show content (heading or table/list)
  await expect(page.getByText(/saved comparisons|e2e delete test|e2e/i).first()).toBeVisible({ timeout: 10000 });

  // Clean up: delete the second event via API
  await fetch(`${apiBase}/api/events/${secondEventId}`, {
    method: 'DELETE',
    headers: {
      Cookie: `ofl.sid=${sessionCookie}`,
      'CSRF-Token': csrfToken,
    },
  });
});
