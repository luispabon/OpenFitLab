import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/svelte';
import { afterEach, vi } from 'vitest';

afterEach(cleanup);

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Suppress "Not implemented: HTMLCanvasElement's getContext()" from jsdom when chart code runs
const noop = () => {};
const mockContext = {
  getImageData: noop,
  putImageData: noop,
  fillRect: noop,
  clearRect: noop,
  fillText: noop,
  measureText: () => ({ width: 0 }),
  canvas: { width: 0, height: 0, style: {} },
  save: noop,
  restore: noop,
  translate: noop,
  scale: noop,
  beginPath: noop,
  moveTo: noop,
  lineTo: noop,
  stroke: noop,
  fill: noop,
  rect: noop,
  arc: noop,
  getContextAttributes: () => ({}),
};
if (typeof HTMLCanvasElement !== 'undefined' && HTMLCanvasElement.prototype.getContext) {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(mockContext as unknown as CanvasRenderingContext2D);
}
