/**
 * Comparisons flow: upload a second event, select 2 activities, create a
 * comparison, save it, then open the saved comparison view.
 */
import { test, expect } from '../fixtures/auth.js';
import { resolve } from 'node:path';

test('can create and view a saved comparison', async ({ page, csrfToken, sessionCookie, apiBase }) => {
  // Upload both events specifically for this test so it is self-contained and unaffected
  // by other parallel tests that share the same user session (e.g. delete-event deleting
  // the seeded event between load and save).
  const tcxPath = resolve(__dirname, '../../backend/test/fixtures/minimal.tcx');
  const { readFileSync } = await import('node:fs');
  const tcxBytes = readFileSync(tcxPath);

  async function uploadEvent(filename: string): Promise<string> {
    const formData = new FormData();
    formData.append('files', new Blob([tcxBytes], { type: 'application/octet-stream' }), filename);
    const res = await fetch(`${apiBase}/api/events`, {
      method: 'POST',
      headers: { Cookie: `ofl.sid=${sessionCookie}`, 'CSRF-Token': csrfToken },
      body: formData,
    });
    expect(res.ok).toBe(true);
    const body = (await res.json()) as {
      results: Array<{ success: boolean; event?: { id: string } }>;
    };
    const id = body.results.find((r) => r.success && r.event)?.event?.id;
    expect(id).toBeDefined();
    return id!;
  }

  const [firstEventId, secondEventId] = await Promise.all([
    uploadEvent('compare-a.tcx'),
    uploadEvent('compare-b.tcx'),
  ]);

  // Navigate directly to the comparison URL using the known event IDs.
  await page.goto(`/#/compare/new?events=${firstEventId},${secondEventId}`);

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

  // Clean up: delete both events (cascade-deletes the saved comparison too)
  await Promise.all(
    [firstEventId, secondEventId].map((id) =>
      fetch(`${apiBase}/api/events/${id}`, {
        method: 'DELETE',
        headers: { Cookie: `ofl.sid=${sessionCookie}`, 'CSRF-Token': csrfToken },
      })
    )
  );
});
