import { toPng } from 'html-to-image';

// Exclude UI controls marked with [data-export-exclude] (e.g. ExportButton itself)
// from the captured image. Defined at module scope to avoid reallocating on every call.
const excludeExportControls = (node: Node): boolean =>
  !(node instanceof Element && node.hasAttribute('data-export-exclude'));

/**
 * Captures a DOM element (including any embedded <canvas> elements, such as Chart.js
 * charts or a MapLibre WebGL canvas with preserveDrawingBuffer enabled) and triggers
 * a browser download of the result as a retina-quality PNG.
 *
 * Background: uses the --color-surface-solid CSS custom property (the opaque dark
 * surface colour) so that semi-transparent bg-card / bg-surface values don't produce
 * a transparent PNG when composited without a parent background.
 *
 * Export-only UI controls (e.g. the ExportButton itself) are excluded from the
 * capture via [data-export-exclude] so they don't appear in the exported image.
 */
export async function exportAsPng(element: HTMLElement, filename: string): Promise<void> {
  // Use the opaque solid-surface colour; fall back to a matching dark hex if the
  // CSS variable is not defined (e.g. in tests or un-themed environments).
  const solidBg =
    getComputedStyle(document.documentElement).getPropertyValue('--color-surface-solid').trim() ||
    '#0e0e10';

  // html-to-image copies webfont @font-face rules into a same-origin stylesheet. The
  // Google Fonts sheets are cross-origin and unreadable, and production builds have no
  // inline stylesheet, so the fonts would be dropped and captured text would reflow in a
  // fallback font (e.g. wrapping the card title). This temporary style element is that target.
  const fontStyle = document.createElement('style');
  document.head.appendChild(fontStyle);
  let dataUrl: string;
  try {
    dataUrl = await toPng(element, {
      pixelRatio: 2,
      backgroundColor: solidBg,
      filter: excludeExportControls,
    });
  } finally {
    fontStyle.remove();
  }
  const a = document.createElement('a');
  a.download = `${filename}.png`;
  a.href = dataUrl;
  // Append to the document before clicking — some browsers require the anchor
  // to be in the DOM for the download attribute to take effect.
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
