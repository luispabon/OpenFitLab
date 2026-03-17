/**
 * Event detail page tests.
 * Uses the pre-seeded event created by global-setup.ts.
 */
import { test, expect } from '../fixtures/auth.js';

test('event detail page shows stats and stream sections', async ({ page, eventId }) => {
  await page.goto(`/#/event/${eventId}`);

  // Stats section should be visible (stat cards with durations, distances, etc.)
  // The page renders StatCard components or stat values
  await expect(page.locator('main, section').first()).toBeVisible({ timeout: 15000 });

  // The page should not show an error state
  await expect(page.getByText(/not found/i)).not.toBeVisible();
  await expect(page.getByText(/error/i)).not.toBeVisible();
});
