/**
 * Folder CRUD flow: create folder, move event into it, filter, rename, delete
 * folder (event should become unfiled, not deleted).
 */
import { test, expect } from '../fixtures/auth.js';

test('folder create / move / filter / rename / delete flow', async ({
  page,
  csrfToken,
  sessionCookie,
  apiBase,
  eventId,
}) => {
  await page.goto('/');
  await expect(page.getByRole('table')).toBeVisible({ timeout: 15000 });

  // --- Create folder ---
  // Click the "New folder" button in the sidebar
  await page.getByRole('button', { name: /new folder/i }).click();

  const folderNameInput = page.getByRole('dialog').getByRole('textbox');
  await folderNameInput.fill('E2E Folder');
  await page.getByRole('dialog').getByRole('button', { name: /create/i }).click();

  // Folder should appear in the sidebar
  await expect(page.getByText('E2E Folder')).toBeVisible({ timeout: 10000 });

  // --- Move event into folder via API (faster than UI drag) ---
  // First fetch folders to get the new folder id
  const foldersRes = await fetch(`${apiBase}/api/folders`, {
    headers: { Cookie: `ofl.sid=${sessionCookie}` },
  });
  expect(foldersRes.ok).toBe(true);
  const foldersBody = (await foldersRes.json()) as Array<{ id: string; name: string }>;
  const folder = foldersBody.find((f) => f.name === 'E2E Folder');
  expect(folder).toBeDefined();
  const folderId = folder!.id;

  const moveRes = await fetch(`${apiBase}/api/events/${eventId}`, {
    method: 'PATCH',
    headers: {
      Cookie: `ofl.sid=${sessionCookie}`,
      'CSRF-Token': csrfToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ folderId }),
  });
  expect(moveRes.ok).toBe(true);

  // --- Filter by folder ---
  await page.getByRole('link', { name: 'E2E Folder' }).click();
  await expect(page.getByRole('table')).toBeVisible({ timeout: 10000 });
  // The seeded event should appear in this folder view (header + at least 1 data row)
  await expect(async () => {
    const count = await page.locator('tr').count();
    expect(count).toBeGreaterThanOrEqual(2);
  }).toPass({ timeout: 10000 });

  // --- Rename folder ---
  // Right-click or use context menu button on the folder
  const folderOptionsBtn = page.getByRole('button', { name: /folder options for e2e folder/i });
  await folderOptionsBtn.click();
  await page.getByRole('menuitem', { name: /rename/i }).click();

  const renameInput = page.getByRole('dialog').getByRole('textbox');
  await renameInput.fill('E2E Folder Renamed');
  await page.getByRole('dialog').getByRole('button', { name: /save|rename/i }).click();

  await expect(page.getByRole('link', { name: 'E2E Folder Renamed' })).toBeVisible({ timeout: 10000 });

  // --- Delete folder ---
  const renamedFolderOptionsBtn = page.getByRole('button', {
    name: /folder options for e2e folder renamed/i,
  });
  await renamedFolderOptionsBtn.click();
  await page.getByRole('menuitem', { name: /delete/i }).click();

  // Confirm deletion in dialog
  const confirmBtn = page.getByRole('dialog').getByRole('button', { name: /delete/i });
  await confirmBtn.click();

  // Folder is gone from sidebar
  await expect(page.getByRole('link', { name: 'E2E Folder Renamed' })).not.toBeVisible({ timeout: 10000 });

  // Event should still exist (unfiled) — navigate to All and verify
  await page.getByRole('link', { name: /workouts/i }).first().click();
  await expect(page.getByRole('table')).toBeVisible({ timeout: 10000 });
  await expect(async () => {
    const count = await page.locator('tr').count();
    expect(count).toBeGreaterThanOrEqual(2);
  }).toPass({ timeout: 10000 });
});
