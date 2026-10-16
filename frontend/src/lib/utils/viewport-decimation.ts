import type { Chart, Plugin } from 'chart.js';

/** One chart point. `y: null` is a gap, drawn as a break with `spanGaps: false`. */
export interface ViewportPoint {
  x: number;
  y: number | null;
}

export interface ViewportDecimationOptions {
  /** Left edge of the visible x range. */
  minX: number;
  /** Right edge of the visible x range. */
  maxX: number;
  /** Number of equal-width x buckets across [minX, maxX]. */
  targetBucketCount: number;
}

/** Decimate only when the candidate selection holds more than this many points per bucket. */
const DECIMATION_POINTS_PER_BUCKET = 4;

/**
 * Reduce `points` to the ones needed to draw the viewport [minX, maxX].
 *
 * `points` must be sorted by non-decreasing x. The selection is every point in [minX, maxX]
 * plus the nearest point on each side. Below the threshold, or when the result would not be
 * shorter, the input array itself is returned. Otherwise the result holds the original point
 * objects in source order: per bucket the first and last point and the min-y and max-y
 * non-null points (ties keep the earliest), and for every null run in the selection its first
 * and last null plus the adjacent non-null points inside the selection. Never mutates `points`
 * and never creates or changes an x value.
 */
export function decimateViewportPoints(
  points: readonly ViewportPoint[],
  { minX, maxX, targetBucketCount }: ViewportDecimationOptions
): readonly ViewportPoint[] {
  if (
    points.length === 0 ||
    !Number.isFinite(minX) ||
    !Number.isFinite(maxX) ||
    minX >= maxX ||
    !Number.isInteger(targetBucketCount) ||
    targetBucketCount < 1
  ) {
    return points;
  }

  // Points inside the viewport are [first, end). The selection adds one neighbour per side.
  const first = searchX(points, minX, false);
  const end = searchX(points, maxX, true);
  const start = Math.max(0, first - 1);
  const stop = Math.min(points.length, end + 1);
  const selectionCount = stop - start;
  if (selectionCount <= DECIMATION_POINTS_PER_BUCKET * targetBucketCount) {
    return points;
  }

  const keep = new Set<number>();
  if (first > 0) keep.add(first - 1);
  if (end < points.length) keep.add(end);

  const bucketsPerUnit = targetBucketCount / (maxX - minX);
  const bucketOf = (x: number) =>
    Math.min(targetBucketCount - 1, Math.floor((x - minX) * bucketsPerUnit));

  for (let i = first; i < end;) {
    const bucket = bucketOf(points[i].x);
    let last = i;
    while (last + 1 < end && bucketOf(points[last + 1].x) === bucket) last++;

    keep.add(i);
    keep.add(last);
    let minIndex = -1;
    let maxIndex = -1;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let k = i; k <= last; k++) {
      const y = points[k].y;
      if (y === null) continue;
      if (minIndex < 0 || y < minY) {
        minY = y;
        minIndex = k;
      }
      if (maxIndex < 0 || y > maxY) {
        maxY = y;
        maxIndex = k;
      }
    }
    if (minIndex >= 0) {
      keep.add(minIndex);
      keep.add(maxIndex);
    }
    i = last + 1;
  }

  for (let k = start; k < stop;) {
    if (points[k].y !== null) {
      k++;
      continue;
    }
    const runStart = k;
    while (k + 1 < stop && points[k + 1].y === null) k++;
    const runEnd = k;
    keep.add(runStart);
    keep.add(runEnd);
    if (runStart > start) keep.add(runStart - 1);
    if (runEnd + 1 < stop) keep.add(runEnd + 1);
    k++;
  }

  const indices = [...keep].sort((a, b) => a - b);
  if (indices.length >= selectionCount) return points;
  return indices.map((index) => points[index]);
}

/** Index of the first point with x >= value, or with x > value when `strict`. */
function searchX(points: readonly ViewportPoint[], value: number, strict: boolean): number {
  let low = 0;
  let high = points.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    const x = points[mid].x;
    if (strict ? x <= value : x < value) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  return low;
}

/** Min and max of the non-null y values, or null when there are none. */
export function nonNullYRange(
  points: readonly ViewportPoint[]
): { min: number; max: number } | null {
  let min = Infinity;
  let max = -Infinity;
  for (const { y } of points) {
    if (y === null) continue;
    if (y < min) min = y;
    if (y > max) max = y;
  }
  return min <= max ? { min, max } : null;
}

export interface ViewportDecimationPluginOptions {
  /** Complete source points. Read-only here; every reduction is computed from this array. */
  fullPoints: readonly ViewportPoint[];
  /** Plugin id. Defaults to `viewportDecimation`. */
  id?: string;
}

/**
 * Local Chart.js plugin for a single-dataset line chart. Before each update it replaces
 * dataset 0 with `decimateViewportPoints(fullPoints, ...)` for the current x range and bucket
 * count (half the canvas width). Results are cached by range and bucket count, so updates with
 * unchanged inputs do not reassign the data. If the x range is missing, dataset 0 is set back to
 * `fullPoints`. The plugin is not registered globally.
 */
export function createViewportDecimationPlugin({
  fullPoints,
  id = 'viewportDecimation',
}: ViewportDecimationPluginOptions): Plugin<'line'> {
  let cache: { minX: number; maxX: number; bucketCount: number } | null = null;

  return {
    id,
    beforeUpdate(chart: Chart<'line'>) {
      const dataset = chart.data.datasets[0];
      if (!dataset) return;

      // Zoom and pan write the live range to the x scale options before they call update.
      const xOptions = chart.options.scales?.x;
      const minX = xOptions?.min;
      const maxX = xOptions?.max;
      if (typeof minX !== 'number' || typeof maxX !== 'number') {
        // No usable range: show the full source rather than a reduction of an unknown range.
        cache = null;
        dataset.data = fullPoints as ViewportPoint[];
        return;
      }

      // chart.width is the current canvas width. chartArea is laid out after beforeUpdate, so it
      // would lag a resize by one update.
      const bucketCount = Number.isFinite(chart.width)
        ? Math.max(2, Math.floor(chart.width / 2))
        : 2;
      if (cache?.minX === minX && cache.maxX === maxX && cache.bucketCount === bucketCount) {
        return;
      }
      cache = { minX, maxX, bucketCount };

      dataset.data = decimateViewportPoints(fullPoints, {
        minX,
        maxX,
        targetBucketCount: bucketCount,
      }) as ViewportPoint[];
    },
  };
}
