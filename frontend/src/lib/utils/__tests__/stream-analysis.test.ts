import { describe, it, expect } from 'vitest';
import {
  alignStreams,
  buildDeltaSeries,
  computePearson,
  computeLinearRegression,
  computeStreamAnalysisStats,
} from '../stream-analysis';

describe('computePearson', () => {
  it('returns 1 for perfectly correlated pairs', () => {
    const pairs = [
      { x: 1, y: 1 },
      { x: 2, y: 2 },
      { x: 3, y: 3 },
      { x: 4, y: 4 },
    ];
    expect(computePearson(pairs)).toBeCloseTo(1, 5);
  });

  it('returns -1 for perfectly inversely correlated pairs', () => {
    const pairs = [
      { x: 1, y: 4 },
      { x: 2, y: 3 },
      { x: 3, y: 2 },
      { x: 4, y: 1 },
    ];
    expect(computePearson(pairs)).toBeCloseTo(-1, 5);
  });

  it('returns ~0 for uncorrelated pairs', () => {
    const pairs = [
      { x: 1, y: 3 },
      { x: 2, y: 1 },
      { x: 3, y: 4 },
      { x: 4, y: 2 },
    ];
    const r = computePearson(pairs);
    expect(Math.abs(r)).toBeLessThan(0.5);
  });

  it('returns 0 for fewer than 2 pairs', () => {
    expect(computePearson([])).toBe(0);
    expect(computePearson([{ x: 1, y: 1 }])).toBe(0);
  });

  it('returns 0 when all x values are the same (no x variance)', () => {
    const pairs = [
      { x: 5, y: 1 },
      { x: 5, y: 2 },
      { x: 5, y: 3 },
    ];
    expect(computePearson(pairs)).toBe(0);
  });
});

describe('computeLinearRegression', () => {
  it('returns correct slope and intercept for y = 2x + 1', () => {
    const pairs = [
      { x: 1, y: 3 },
      { x: 2, y: 5 },
      { x: 3, y: 7 },
      { x: 4, y: 9 },
    ];
    const { slope, intercept, r2 } = computeLinearRegression(pairs);
    expect(slope).toBeCloseTo(2, 5);
    expect(intercept).toBeCloseTo(1, 5);
    expect(r2).toBeCloseTo(1, 5);
  });

  it('returns defaults for fewer than 2 pairs', () => {
    const { slope, intercept, r2 } = computeLinearRegression([]);
    expect(slope).toBe(1);
    expect(intercept).toBe(0);
    expect(r2).toBe(0);
  });

  it('returns defaults when no x variance', () => {
    const pairs = [
      { x: 5, y: 1 },
      { x: 5, y: 2 },
    ];
    const { slope, intercept, r2 } = computeLinearRegression(pairs);
    expect(slope).toBe(1);
    expect(intercept).toBe(0);
    expect(r2).toBe(0);
  });
});

describe('alignStreams', () => {
  const refStart = 1_000_000;
  const secStart = 2_000_000;

  it('aligns perfectly overlapping streams', () => {
    const refPoints = [
      { time: refStart + 0, value: 100 },
      { time: refStart + 1000, value: 110 },
      { time: refStart + 2000, value: 120 },
    ];
    const secPoints = [
      { time: secStart + 0, value: 101 },
      { time: secStart + 1000, value: 111 },
      { time: secStart + 2000, value: 121 },
    ];
    const pairs = alignStreams(refPoints, secPoints, refStart, secStart);
    expect(pairs).toHaveLength(3);
    expect(pairs[0]).toEqual({ x: 100, y: 101 });
    expect(pairs[1]).toEqual({ x: 110, y: 111 });
    expect(pairs[2]).toEqual({ x: 120, y: 121 });
  });

  it('excludes pairs beyond 30-second tolerance', () => {
    const refPoints = [
      { time: refStart + 0, value: 100 },
      { time: refStart + 60_000, value: 110 }, // 60s
    ];
    const secPoints = [
      { time: secStart + 0, value: 101 },
      // No point near 60s – nearest is at 0s = 60s apart > 30s tolerance
    ];
    const pairs = alignStreams(refPoints, secPoints, refStart, secStart);
    // First pair: 0ms diff → included. Second ref point: nearest sec is 0s, diff = 60s → excluded.
    expect(pairs).toHaveLength(1);
    expect(pairs[0]).toEqual({ x: 100, y: 101 });
  });

  it('returns empty array for empty inputs', () => {
    expect(alignStreams([], [], 0, 0)).toHaveLength(0);
    expect(alignStreams([{ time: 1000, value: 100 }], [], 0, 0)).toHaveLength(0);
    expect(alignStreams([], [{ time: 1000, value: 100 }], 0, 0)).toHaveLength(0);
  });

  it('handles single matching point', () => {
    const pairs = alignStreams(
      [{ time: 1000, value: 80 }],
      [{ time: 2000, value: 82 }],
      1000,
      2000
    );
    expect(pairs).toHaveLength(1);
    expect(pairs[0]).toEqual({ x: 80, y: 82 });
  });

  it('ignores non-numeric values', () => {
    const refPoints = [
      { time: 1000, value: 100 },
      { time: 2000, value: { invalid: true } as unknown as number },
    ];
    const secPoints = [
      { time: 1000, value: 101 },
      { time: 2000, value: 102 },
    ];
    const pairs = alignStreams(refPoints, secPoints, 0, 0);
    expect(pairs).toHaveLength(1);
  });
});

describe('buildDeltaSeries', () => {
  it('builds delta series with correct elapsed time and difference', () => {
    const refStart = 0;
    const secStart = 5000;
    const refPoints = [
      { time: 0, value: 100 },
      { time: 1000, value: 110 },
    ];
    const secPoints = [
      { time: 5000, value: 103 },
      { time: 6000, value: 108 },
    ];
    const series = buildDeltaSeries(refPoints, secPoints, refStart, secStart);
    expect(series).toHaveLength(2);
    expect(series[0].x).toBe(0); // elapsed 0ms
    expect(series[0].y).toBeCloseTo(3); // 103 - 100
    expect(series[1].x).toBe(1000);
    expect(series[1].y).toBeCloseTo(-2); // 108 - 110
  });

  it('returns empty for empty inputs', () => {
    expect(buildDeltaSeries([], [], 0, 0)).toHaveLength(0);
  });
});

describe('computeStreamAnalysisStats', () => {
  it('returns zero stats for empty pairs', () => {
    const stats = computeStreamAnalysisStats([]);
    expect(stats.n).toBe(0);
    expect(stats.r).toBe(0);
    expect(stats.r2).toBe(0);
    expect(stats.meanDiff).toBe(0);
    expect(stats.maxAbsDiff).toBe(0);
  });

  it('computes correct stats for perfect correlation', () => {
    const pairs = [
      { x: 1, y: 1 },
      { x: 2, y: 2 },
      { x: 3, y: 3 },
    ];
    const stats = computeStreamAnalysisStats(pairs);
    expect(stats.r).toBeCloseTo(1, 5);
    expect(stats.r2).toBeCloseTo(1, 5);
    expect(stats.n).toBe(3);
    expect(stats.meanDiff).toBeCloseTo(0, 5);
    expect(stats.maxAbsDiff).toBeCloseTo(0, 5);
  });

  it('computes mean diff and max abs diff correctly', () => {
    // y is always x + 5
    const pairs = [
      { x: 100, y: 105 },
      { x: 110, y: 115 },
      { x: 120, y: 123 }, // y - x = 3
    ];
    const stats = computeStreamAnalysisStats(pairs);
    expect(stats.meanDiff).toBeCloseTo((5 + 5 + 3) / 3, 5);
    expect(stats.maxAbsDiff).toBeCloseTo(5, 5);
  });
});
