/**
 * Authenticated dashboard (workouts) tests.
 */
import { test, expect } from '../fixtures/auth.js';

test('dashboard loads with sidebar and activity table', async ({ page }) => {
  await page.goto('/');

  // Sidebar navigation should be visible
  await expect(page.getByRole('link', { name: /workouts/i })).toBeVisible();

  // The workouts section should render (table or empty state)
  // Wait for any loading spinner to disappear
  await expect(page.locator('.material-icons').filter({ hasText: 'dashboard' })).toBeVisible();
});

test('activity list shows the pre-seeded event', async ({ page }) => {
  await page.goto('/');

  // Wait for loading to finish — the table row or an activity name
  // The seeded event is a Running activity from minimal.tcx
  await expect(page.getByRole('table')).toBeVisible({ timeout: 15000 });

  // At least one row should be visible (the seeded event: header + at least 1 data row).
  // Data rows use role="link" on <tr>, so use a CSS locator instead of getByRole('row').
  await expect(async () => {
    const rowCount = await page.locator('tr').count();
    expect(rowCount).toBeGreaterThanOrEqual(2);
  }).toPass({ timeout: 15000 });
});
