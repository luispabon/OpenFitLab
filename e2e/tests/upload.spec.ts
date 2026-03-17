/**
 * File upload tests — upload minimal.tcx via the file input and verify the
 * event appears in the activity list.
 */
import { test, expect } from '../fixtures/auth.js';
import { resolve } from 'node:path';

test('uploading a TCX file creates an event visible in the list', async ({ page }) => {
  await page.goto('/');

  // Wait for the initial load to settle — table must have data before capturing baseline
  await expect(page.getByRole('table')).toBeVisible({ timeout: 15000 });
  await expect(async () => {
    const count = await page.locator('tr').count();
    expect(count).toBeGreaterThanOrEqual(2);
  }).toPass({ timeout: 15000 });
  const initialRows = await page.locator('tr').count();

  // Locate the hidden file input inside the upload section
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(resolve(__dirname, '../../backend/test/fixtures/minimal.tcx'));

  // After upload completes the list should refresh with at least one additional row
  await expect(async () => {
    const count = await page.locator('tr').count();
    expect(count).toBeGreaterThanOrEqual(initialRows + 1);
  }).toPass({ timeout: 30000 });
});
