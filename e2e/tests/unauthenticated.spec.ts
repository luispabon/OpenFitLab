/**
 * Unauthenticated access tests.
 * These tests must NOT use storageState so they run without a session cookie.
 */
import { test, expect } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });

test('root route shows login page with only configured OAuth buttons', async ({ page }) => {
  await page.goto('/');
  // svelte-spa-router renders #/ for root; the login page is shown when unauthenticated
  await expect(page.getByText('Sign in to continue')).toBeVisible();
  // Google is the only provider configured in compose.e2e.yaml; the rest must stay hidden.
  await expect(page.getByRole('button', { name: /google/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /github/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /apple/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /facebook/i })).toHaveCount(0);
});

test('comparisons route without session shows login page', async ({ page }) => {
  await page.goto('/#/comparisons');
  await expect(page.getByText('Sign in to continue')).toBeVisible();
});
