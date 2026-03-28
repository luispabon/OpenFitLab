import { describe, it, expect } from 'vitest';
import { splitFoldersForNav } from '../folder-nav-sort';
import type { Folder } from '../../types/event';

describe('splitFoldersForNav', () => {
  it('sorts pinned and unpinned by name', () => {
    const folders: Folder[] = [
      { id: '1', name: 'Zebra', color: '#000', pinned: false },
      { id: '2', name: 'Alpha', color: '#000', pinned: true },
      { id: '3', name: 'Beta', color: '#000', pinned: true },
      { id: '4', name: 'Mango', color: '#000', pinned: false },
    ];
    const { pinned, unpinned } = splitFoldersForNav(folders);
    expect(pinned.map((f) => f.name)).toEqual(['Alpha', 'Beta']);
    expect(unpinned.map((f) => f.name)).toEqual(['Mango', 'Zebra']);
  });
});
