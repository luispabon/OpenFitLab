/**
 * Stream analysis utilities for comparison: alignment, correlation, regression.
 * Pure functions – no Svelte dependencies.
 */

export interface AlignedPair {
  x: number; // reference value
  y: number; // secondary value
}

export interface DeltaPoint {
  x: number; // elapsed ms (from reference start)
  y: number; // secondary value − reference value
}

export interface LinearRegression {
  slope: number;
  intercept: number;
  r2: number;
}

export interface StreamAnalysisStats {
  r: number;
  r2: number;
  slope: number;
  intercept: number;
  n: number;
  meanDiff: number;
  maxAbsDiff: number;
}

const TOLERANCE_MS = 30_000; // 30 seconds

type StreamPoint = { time: number; value: number | Record<string, unknown> };

/**
 * Find the index of the secondary point nearest to the target elapsed time.
 * Uses binary search. Returns -1 if the array is empty.
 */
function findNearestIndex(arr: Array<{ elapsed: number; value: number }>, target: number): number {
  if (arr.length === 0) return -1;
  let lo = 0;
  let hi = arr.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid].elapsed < target) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  // Compare lo and lo-1
  if (lo > 0 && Math.abs(arr[lo - 1].elapsed - target) <= Math.abs(arr[lo].elapsed - target)) {
    return lo - 1;
  }
  return lo;
}

function toElapsedNumeric(
  points: StreamPoint[],
  start: number
): Array<{ elapsed: number; value: number }> {
  return points
    .filter((p) => typeof p.value === 'number' && !Number.isNaN(p.value as number))
    .map((p) => ({ elapsed: p.time - start, value: p.value as number }));
}

/**
 * Nearest-neighbour align two streams by elapsed time.
 * Returns pairs where x = reference value, y = secondary value.
 * Pairs with time gap > 30 s are excluded.
 */
export function alignStreams(
  refPoints: StreamPoint[],
  secPoints: StreamPoint[],
  refStart: number,
  secStart: number
): AlignedPair[] {
  const ref = toElapsedNumeric(refPoints, refStart);
  const sec = toElapsedNumeric(secPoints, secStart);
  if (ref.length === 0 || sec.length === 0) return [];

  const pairs: AlignedPair[] = [];
  for (const rp of ref) {
    const idx = findNearestIndex(sec, rp.elapsed);
    if (idx === -1) continue;
    const diff = Math.abs(sec[idx].elapsed - rp.elapsed);
    if (diff <= TOLERANCE_MS) {
      pairs.push({ x: rp.value, y: sec[idx].value });
    }
  }
  return pairs;
}

/**
 * Build a delta (secondary − reference) series over elapsed time.
 * x = elapsed ms relative to reference start, y = secondary − reference.
 */
export function buildDeltaSeries(
  refPoints: StreamPoint[],
  secPoints: StreamPoint[],
  refStart: number,
  secStart: number
): DeltaPoint[] {
  const ref = toElapsedNumeric(refPoints, refStart);
  const sec = toElapsedNumeric(secPoints, secStart);
  if (ref.length === 0 || sec.length === 0) return [];

  const series: DeltaPoint[] = [];
  for (const rp of ref) {
    const idx = findNearestIndex(sec, rp.elapsed);
    if (idx === -1) continue;
    const diff = Math.abs(sec[idx].elapsed - rp.elapsed);
    if (diff <= TOLERANCE_MS) {
      series.push({ x: rp.elapsed, y: sec[idx].value - rp.value });
    }
  }
  return series;
}

/**
 * Pearson correlation coefficient from aligned pairs.
 * Returns 0 if fewer than 2 pairs or no variance.
 */
export function computePearson(pairs: AlignedPair[]): number {
  const n = pairs.length;
  if (n < 2) return 0;

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  let sumY2 = 0;

  for (const { x, y } of pairs) {
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
    sumY2 += y * y;
  }

  const num = n * sumXY - sumX * sumY;
  const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  if (den === 0) return 0;
  return num / den;
}

/**
 * Ordinary least-squares linear regression from aligned pairs.
 * Returns slope=1, intercept=0, r2=0 if fewer than 2 pairs or no variance.
 */
export function computeLinearRegression(pairs: AlignedPair[]): LinearRegression {
  const n = pairs.length;
  if (n < 2) return { slope: 1, intercept: 0, r2: 0 };

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;

  for (const { x, y } of pairs) {
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
  }

  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return { slope: 1, intercept: 0, r2: 0 };

  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  const r = computePearson(pairs);
  return { slope, intercept, r2: r * r };
}

/**
 * Compute all stream analysis stats from aligned pairs.
 */
export function computeStreamAnalysisStats(pairs: AlignedPair[]): StreamAnalysisStats {
  const n = pairs.length;
  if (n === 0) {
    return { r: 0, r2: 0, slope: 1, intercept: 0, n: 0, meanDiff: 0, maxAbsDiff: 0 };
  }

  const r = computePearson(pairs);
  const { slope, intercept, r2 } = computeLinearRegression(pairs);

  let sumDiff = 0;
  let maxAbsDiff = 0;
  for (const { x, y } of pairs) {
    const diff = y - x;
    sumDiff += diff;
    if (Math.abs(diff) > maxAbsDiff) maxAbsDiff = Math.abs(diff);
  }
  const meanDiff = sumDiff / n;

  return { r, r2, slope, intercept, n, meanDiff, maxAbsDiff };
}
