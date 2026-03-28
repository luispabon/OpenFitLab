import type { Folder } from '../types/event';

/** Same ordering as the sidebar: pinned first (name), then unpinned (name). */
export function splitFoldersForNav(folders: Folder[]): {
  pinned: Folder[];
  unpinned: Folder[];
} {
  const pinned = [...folders].filter((f) => f.pinned).sort((a, b) => a.name.localeCompare(b.name));
  const unpinned = [...folders]
    .filter((f) => !f.pinned)
    .sort((a, b) => a.name.localeCompare(b.name));
  return { pinned, unpinned };
}
