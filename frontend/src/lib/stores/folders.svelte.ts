import { getFolders as fetchFolders } from '../api/folders';
import type { Folder } from '../types/event';

export const foldersState = $state({
  folders: [] as Folder[],
  loading: false,
  error: null as string | null,
  currentHash: typeof window !== 'undefined' ? window.location.hash : '#/',
});

export function setFolderHash(hash: string) {
  foldersState.currentHash = hash;
}

export async function loadFolders(): Promise<Folder[]> {
  foldersState.loading = true;
  foldersState.error = null;
  try {
    const list = await fetchFolders();
    foldersState.folders = list;
    return list;
  } catch (e) {
    foldersState.error = e instanceof Error ? e.message : 'Failed to load folders';
    return [];
  } finally {
    foldersState.loading = false;
  }
}

export function getFolderFromHash(hash: string): 'all' | 'unfiled' | string {
  const match = hash.match(/[?&]folder=([^&]*)/);
  const value = match ? decodeURIComponent(match[1]).trim() : '';
  if (value === 'unfiled') return 'unfiled';
  if (value === 'all' || value === '') return 'all';
  return value;
}

export function buildFolderHash(folderId: 'all' | 'unfiled' | string): string {
  if (folderId === 'all') return '#/';
  return `#/?folder=${encodeURIComponent(folderId)}`;
}
