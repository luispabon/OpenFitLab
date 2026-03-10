import { describe, it, expect, vi, beforeEach } from 'vitest';
import { foldersState, loadFolders, getFolderFromHash, buildFolderHash } from '../folders.svelte';

const mockGetFolders = vi.fn();

vi.mock('../../api/folders', () => ({
  getFolders: (...args: unknown[]) => mockGetFolders(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
  foldersState.folders = [];
  foldersState.loading = false;
  foldersState.error = null;
});

describe('getFolderFromHash', () => {
  it('returns "all" for an empty hash', () => {
    expect(getFolderFromHash('')).toBe('all');
  });

  it('returns "all" for hash without folder param', () => {
    expect(getFolderFromHash('#/')).toBe('all');
    expect(getFolderFromHash('#/comparisons')).toBe('all');
  });

  it('returns "unfiled" for ?folder=unfiled', () => {
    expect(getFolderFromHash('#/?folder=unfiled')).toBe('unfiled');
  });

  it('returns "all" for ?folder=all', () => {
    expect(getFolderFromHash('#/?folder=all')).toBe('all');
  });

  it('returns the folder UUID for a valid UUID folder', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    expect(getFolderFromHash(`#/?folder=${uuid}`)).toBe(uuid);
  });

  it('returns "all" for a malformed hash with no folder value', () => {
    expect(getFolderFromHash('#/?folder=')).toBe('all');
    expect(getFolderFromHash('#/?folder=   ')).toBe('all');
  });

  it('handles encoded folder values', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    const encoded = encodeURIComponent(uuid);
    expect(getFolderFromHash(`#/?folder=${encoded}`)).toBe(uuid);
  });
});

describe('buildFolderHash', () => {
  it('returns "#/" for "all"', () => {
    expect(buildFolderHash('all')).toBe('#/');
  });

  it('returns encoded folder hash for a UUID', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    const hash = buildFolderHash(uuid);
    expect(hash).toContain(uuid);
    expect(hash).toMatch(/^#\//);
  });

  it('returns encoded folder hash for "unfiled"', () => {
    const hash = buildFolderHash('unfiled');
    expect(hash).toContain('unfiled');
  });
});

describe('buildFolderHash / getFolderFromHash round-trip', () => {
  it('round-trips "all"', () => {
    expect(getFolderFromHash(buildFolderHash('all'))).toBe('all');
  });

  it('round-trips "unfiled"', () => {
    expect(getFolderFromHash(buildFolderHash('unfiled'))).toBe('unfiled');
  });

  it('round-trips a UUID folder ID', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    expect(getFolderFromHash(buildFolderHash(uuid))).toBe(uuid);
  });
});

describe('loadFolders', () => {
  it('sets loading to true then false and populates folders', async () => {
    const folders = [
      { id: 'f1', name: 'Runs', color: '#ef4444', pinned: false },
      { id: 'f2', name: 'Cycling', color: '#3b82f6', pinned: true },
    ];
    let capturedLoading: boolean | undefined;

    mockGetFolders.mockImplementation(() => {
      capturedLoading = foldersState.loading;
      return Promise.resolve(folders);
    });

    await loadFolders();

    expect(capturedLoading).toBe(true);
    expect(foldersState.loading).toBe(false);
    expect(foldersState.folders).toEqual(folders);
    expect(foldersState.error).toBeNull();
  });

  it('sets loading to false and returns empty array on API error', async () => {
    mockGetFolders.mockRejectedValue(new Error('Network error'));

    const result = await loadFolders();

    expect(result).toEqual([]);
    expect(foldersState.loading).toBe(false);
    expect(foldersState.error).toBe('Network error');
    expect(foldersState.folders).toEqual([]);
  });

  it('sets a generic error message when thrown error is not an Error instance', async () => {
    mockGetFolders.mockRejectedValue('some string error');

    await loadFolders();

    expect(foldersState.error).toBe('Failed to load folders');
  });
});
