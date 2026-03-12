import { toPng } from 'html-to-image';

// Exclude UI controls marked with [data-export-exclude] (e.g. ExportButton itself)
// from the captured image. Defined at module scope to avoid reallocating on every call.
const excludeExportControls = (node: Node): boolean =>
  !(node instanceof Element && node.hasAttribute('data-export-exclude'));

/**
 * Captures a DOM element (including any embedded <canvas> elements, such as uPlot
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
    '#121223';

  const dataUrl = await toPng(element, {
    pixelRatio: 2,
    backgroundColor: solidBg,
    // Skip font embedding: avoids cross-origin requests to Google Fonts. The font
    // is already loaded in the browser and its glyphs are drawn into the canvas
    // pixels directly, so the exported image looks correct without it.
    skipFonts: true,
    filter: excludeExportControls,
  });
  const a = document.createElement('a');
  a.download = `${filename}.png`;
  a.href = dataUrl;
  // Append to the document before clicking — some browsers require the anchor
  // to be in the DOM for the download attribute to take effect.
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
