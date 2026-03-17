/**
 * Tier 2: 404 / not-found route — navigating to an unknown hash route shows the
 * not-found page and "Back to Workouts" button navigates home.
 */
import { test, expect } from '../fixtures/auth.js';

test('unknown route shows not-found page with back button', async ({ page }) => {
  await page.goto('/#/nonexistent');

  await expect(page.getByText('Page not found')).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('button', { name: /back to workouts/i })).toBeVisible();

  // Clicking the button navigates to the workouts/dashboard
  await page.getByRole('button', { name: /back to workouts/i }).click();
  await expect(page).toHaveURL(/#\/$|#\/|\/$/);
  await expect(page.getByRole('table')).toBeVisible({ timeout: 15000 });
});
