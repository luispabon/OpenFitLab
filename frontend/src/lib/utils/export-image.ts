import { toPng } from 'html-to-image';

// Exclude UI controls marked with [data-export-exclude] (e.g. ExportButton itself)
// from the captured image. Defined at module scope to avoid reallocating on every call.
const excludeExportControls = (node: Node): boolean =>
  !(node instanceof Element && node.hasAttribute('data-export-exclude'));

// Shared same-origin stylesheet for webfont embedding, and the number of exports using it.
let fontStyle: HTMLStyleElement | null = null;
let inFlightExports = 0;

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

  // html-to-image copies webfont @font-face rules into the first inline stylesheet it finds.
  // Google Fonts sheets are cross-origin and production builds have no inline stylesheet, so
  // without one the fonts are dropped and captured text reflows (e.g. wrapping the card title).
  // A shared sheet is kept first in <head> while any export is in flight.
  if (inFlightExports === 0) {
    fontStyle = document.createElement('style');
    document.head.insertBefore(fontStyle, document.head.firstChild);
  }
  inFlightExports++;
  let dataUrl: string;
  try {
    dataUrl = await toPng(element, {
      pixelRatio: 2,
      backgroundColor: solidBg,
      filter: excludeExportControls,
    });
  } finally {
    inFlightExports--;
    if (inFlightExports === 0) {
      fontStyle?.remove();
      fontStyle = null;
    }
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
