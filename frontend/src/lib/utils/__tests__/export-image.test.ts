import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exportAsPng } from '../export-image';

vi.mock('html-to-image', () => ({
  toPng: vi.fn().mockResolvedValue('data:image/png;base64,abc123'),
}));

describe('exportAsPng', () => {
  let element: HTMLElement;
  let appendedNodes: Node[];

  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(async () => {
    const { toPng } = await import('html-to-image');
    (toPng as ReturnType<typeof vi.fn>).mockResolvedValue('data:image/png;base64,abc123');

    element = document.createElement('div');
    appendedNodes = [];

    // Capture nodes appended to body (to inspect anchor attributes) and suppress click.
    vi.spyOn(document.body, 'appendChild').mockImplementation((node: Node) => {
      appendedNodes.push(node);
      return node;
    });
    vi.spyOn(document.body, 'removeChild').mockImplementation((node: Node) => node as ChildNode);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  it('calls toPng with the provided element, pixelRatio 2, and skipFonts true', async () => {
    const { toPng } = await import('html-to-image');
    await exportAsPng(element, 'my-export');
    expect(toPng).toHaveBeenCalledWith(
      element,
      expect.objectContaining({ pixelRatio: 2, skipFonts: true })
    );
  });

  it('uses --color-surface-solid CSS variable as backgroundColor', async () => {
    const { toPng } = await import('html-to-image');
    document.documentElement.style.setProperty('--color-surface-solid', 'rgb(18, 18, 35)');
    await exportAsPng(element, 'my-export');
    expect(toPng).toHaveBeenCalledWith(
      element,
      expect.objectContaining({ backgroundColor: 'rgb(18, 18, 35)' })
    );
    document.documentElement.style.removeProperty('--color-surface-solid');
  });

  it('falls back to #121223 backgroundColor when --color-surface-solid is not set', async () => {
    const { toPng } = await import('html-to-image');
    document.documentElement.style.removeProperty('--color-surface-solid');
    await exportAsPng(element, 'my-export');
    expect(toPng).toHaveBeenCalledWith(
      element,
      expect.objectContaining({ backgroundColor: '#121223' })
    );
  });

  it('passes a filter that excludes elements with data-export-exclude', async () => {
    const { toPng } = await import('html-to-image');
    await exportAsPng(element, 'my-export');
    const opts = (toPng as ReturnType<typeof vi.fn>).mock.calls[0][1] as {
      filter: (node: Node) => boolean;
    };
    const excluded = document.createElement('button');
    excluded.setAttribute('data-export-exclude', '');
    const included = document.createElement('div');
    expect(opts.filter(excluded)).toBe(false);
    expect(opts.filter(included)).toBe(true);
    // Non-Element nodes (text nodes) are always included
    expect(opts.filter(document.createTextNode('hello'))).toBe(true);
  });

  it('sets the correct download filename with .png extension', async () => {
    await exportAsPng(element, 'my-export');
    const anchor = appendedNodes[0] as HTMLAnchorElement;
    expect(anchor.download).toBe('my-export.png');
  });

  it('sets the anchor href to the data URL returned by toPng', async () => {
    await exportAsPng(element, 'my-export');
    const anchor = appendedNodes[0] as HTMLAnchorElement;
    expect(anchor.href).toBe('data:image/png;base64,abc123');
  });

  it('appends the anchor to document.body before clicking', async () => {
    await exportAsPng(element, 'my-export');
    expect(document.body.appendChild).toHaveBeenCalledWith(expect.any(HTMLAnchorElement));
  });

  it('removes the anchor from document.body after clicking', async () => {
    await exportAsPng(element, 'my-export');
    expect(document.body.removeChild).toHaveBeenCalledWith(expect.any(HTMLAnchorElement));
  });

  it('propagates errors thrown by toPng to the caller', async () => {
    const { toPng } = await import('html-to-image');
    (toPng as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('canvas error'));
    await expect(exportAsPng(element, 'my-export')).rejects.toThrow('canvas error');
  });
});
