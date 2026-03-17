/**
 * Unauthenticated access tests.
 * These tests must NOT use storageState so they run without a session cookie.
 */
import { test, expect } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });

test('root route shows login page with OAuth buttons', async ({ page }) => {
  await page.goto('/');
  // svelte-spa-router renders #/ for root; the login page is shown when unauthenticated
  await expect(page.getByText('Sign in to continue')).toBeVisible();
  await expect(page.getByRole('button', { name: /google/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /github/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /apple/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /facebook/i })).toBeVisible();
});

test('comparisons route without session shows login page', async ({ page }) => {
  await page.goto('/#/comparisons');
  await expect(page.getByText('Sign in to continue')).toBeVisible();
});
