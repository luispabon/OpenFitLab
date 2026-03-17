/**
 * Tier 2: Account page — verifies export button and delete-account form are present.
 */
import { test, expect } from '../fixtures/auth.js';

test('account page has export button and delete account form', async ({ page }) => {
  await page.goto('/#/account');

  // Export button should be present
  await expect(page.getByRole('button', { name: /export/i }).first()).toBeVisible({ timeout: 10000 });

  // Delete account section should have an input for the confirmation phrase
  await expect(page.getByRole('textbox')).toBeVisible();

  // The delete button should exist (but be disabled without confirmation)
  await expect(page.getByRole('button', { name: /permanently delete my account/i })).toBeVisible();
});
