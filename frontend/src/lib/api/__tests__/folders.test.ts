import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getFolders, getFolder, createFolder, updateFolder, deleteFolder } from '../folders';

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('getFolders', () => {
  it('returns array of folders on success', async () => {
    const folders = [{ id: 'f1', name: 'Runs', color: '#ef4444', pinned: false }];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(folders),
      })
    );

    const result = await getFolders();

    expect(result).toEqual(folders);
    expect(fetch).toHaveBeenCalledWith('/api/folders', expect.any(Object));
  });

  it('throws on non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        statusText: 'Server Error',
      })
    );

    await expect(getFolders()).rejects.toThrow(/Failed to fetch folders/);
  });

  it('throws when response is not an array', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'f1' }),
      })
    );

    await expect(getFolders()).rejects.toThrow(/Invalid folders response: expected array/);
  });
});

describe('getFolder', () => {
  it('returns folder on success', async () => {
    const folder = { id: 'f1', name: 'Runs', color: '#ef4444', pinned: false };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(folder),
      })
    );

    const result = await getFolder('f1');

    expect(result).toEqual(folder);
    expect(fetch).toHaveBeenCalledWith('/api/folders/f1', expect.any(Object));
  });

  it('throws "Folder not found" on 404', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      })
    );

    await expect(getFolder('missing')).rejects.toThrow('Folder not found');
  });

  it('throws when response is missing id', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ name: 'Runs' }),
      })
    );

    await expect(getFolder('f1')).rejects.toThrow(/Invalid folder response: missing id/);
  });
});

describe('createFolder', () => {
  it('sends POST with body and returns folder', async () => {
    const folder = { id: 'f1', name: 'Runs', color: '#ef4444', pinned: false };
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(folder),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await createFolder({ name: 'Runs', color: '#ef4444' });

    expect(result).toEqual(folder);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/folders',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'Runs', color: '#ef4444' }),
      })
    );
  });

  it('throws error from response body on failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        statusText: 'Bad Request',
        json: () => Promise.resolve({ error: 'Name already taken' }),
      })
    );

    await expect(createFolder({ name: 'Dup', color: '#000' })).rejects.toThrow(
      'Name already taken'
    );
  });
});

describe('updateFolder', () => {
  it('sends PATCH with body and returns updated folder', async () => {
    const folder = { id: 'f1', name: 'Updated', color: '#3b82f6', pinned: true };
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(folder),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await updateFolder('f1', { name: 'Updated', pinned: true });

    expect(result).toEqual(folder);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/folders/f1',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ name: 'Updated', pinned: true }),
      })
    );
  });

  it('throws "Folder not found" on 404', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      })
    );

    await expect(updateFolder('missing', { name: 'x' })).rejects.toThrow('Folder not found');
  });
});

describe('deleteFolder', () => {
  it('calls apiFetch with method DELETE', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
    });
    vi.stubGlobal('fetch', mockFetch);

    await deleteFolder('f1');

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/folders/f1?contents=unfile',
      expect.objectContaining({ method: 'DELETE' })
    );
  });

  it('uses "delete" contents option when specified', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
    });
    vi.stubGlobal('fetch', mockFetch);

    await deleteFolder('f1', 'delete');

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/folders/f1?contents=delete',
      expect.objectContaining({ method: 'DELETE' })
    );
  });

  it('throws "Folder not found" on 404', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      })
    );

    await expect(deleteFolder('missing')).rejects.toThrow('Folder not found');
  });

  it('throws on other non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Server Error',
      })
    );

    await expect(deleteFolder('f1')).rejects.toThrow(/Failed to delete folder/);
  });
});
