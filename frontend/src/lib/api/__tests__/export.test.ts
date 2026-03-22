import { describe, it, expect, vi, beforeEach } from 'vitest';
import { downloadEventTcx, downloadEventGpx } from '../export';

beforeEach(() => {
  vi.restoreAllMocks();
});

function mockFetchOk(contentType = 'application/xml') {
  const blob = new Blob(['<xml/>'], { type: contentType });
  return vi.fn().mockResolvedValue({
    ok: true,
    blob: () => Promise.resolve(blob),
  });
}

function mockFetchFail(status = 404, statusText = 'Not Found') {
  return vi.fn().mockResolvedValue({ ok: false, status, statusText });
}

describe('downloadEventTcx', () => {
  it('calls apiFetch with correct TCX URL', async () => {
    const mockFetch = mockFetchOk();
    vi.stubGlobal('fetch', mockFetch);

    const mockCreateObjectURL = vi.fn().mockReturnValue('blob:url');
    const mockRevokeObjectURL = vi.fn();
    vi.stubGlobal('URL', {
      createObjectURL: mockCreateObjectURL,
      revokeObjectURL: mockRevokeObjectURL,
    });

    const mockAnchor = {
      href: '',
      download: '',
      style: { display: '' },
      click: vi.fn(),
      remove: vi.fn(),
    };
    vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as unknown as HTMLElement);
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockAnchor as unknown as Node);

    await downloadEventTcx('evt-1', 'Morning Run');

    expect(mockFetch).toHaveBeenCalledWith('/api/events/evt-1/export/tcx', expect.any(Object));
    expect(mockAnchor.download).toBe('Morning Run.tcx');
    expect(mockAnchor.click).toHaveBeenCalledOnce();
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:url');
  });

  it('throws when response is not ok', async () => {
    vi.stubGlobal('fetch', mockFetchFail(404, 'Not Found'));

    await expect(downloadEventTcx('evt-1', 'run')).rejects.toThrow('TCX export failed: Not Found');
  });
});

describe('downloadEventGpx', () => {
  it('calls apiFetch with correct GPX URL', async () => {
    const mockFetch = mockFetchOk('application/gpx+xml');
    vi.stubGlobal('fetch', mockFetch);

    const mockCreateObjectURL = vi.fn().mockReturnValue('blob:url');
    const mockRevokeObjectURL = vi.fn();
    vi.stubGlobal('URL', {
      createObjectURL: mockCreateObjectURL,
      revokeObjectURL: mockRevokeObjectURL,
    });

    const mockAnchor = {
      href: '',
      download: '',
      style: { display: '' },
      click: vi.fn(),
      remove: vi.fn(),
    };
    vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as unknown as HTMLElement);
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockAnchor as unknown as Node);

    await downloadEventGpx('evt-1', 'Morning Ride');

    expect(mockFetch).toHaveBeenCalledWith('/api/events/evt-1/export/gpx', expect.any(Object));
    expect(mockAnchor.download).toBe('Morning Ride.gpx');
    expect(mockAnchor.click).toHaveBeenCalledOnce();
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:url');
  });

  it('throws when response is not ok', async () => {
    vi.stubGlobal('fetch', mockFetchFail(404, 'Not Found'));

    await expect(downloadEventGpx('evt-1', 'ride')).rejects.toThrow('GPX export failed: Not Found');
  });
});
