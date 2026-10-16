import { describe, it, expect, vi } from 'vitest';
import type { Chart, Plugin } from 'chart.js';
import {
  alignedYRange,
  createAlignedViewportDecimationPlugin,
  createViewportDecimationPlugin,
  decimateAlignedViewportData,
  decimateViewportPoints,
  nonNullYRange,
  type ViewportDecimationOptions,
  type ViewportPoint,
} from '../viewport-decimation';
import { toXYPoints, type AlignedSeriesData } from '../chart-utils';

/** Points at x = 0..n-1. `yAt` gives the y for each index (default: y = index). */
function series(n: number, yAt: (i: number) => number | null = (i) => i): ViewportPoint[] {
  return Array.from({ length: n }, (_, i) => ({ x: i, y: yAt(i) }));
}

/** Deterministic PRNG so generated data is the same on every run. */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/**
 * Maps each result entry to its source index. Fails unless every entry is the same object as a
 * source point and the indices are strictly increasing (sorted, no duplicates).
 */
function expectOriginalSubset(
  source: readonly ViewportPoint[],
  result: readonly ViewportPoint[]
): number[] {
  const indexOf = new Map(source.map((point, index): [ViewportPoint, number] => [point, index]));
  const indices = result.map((point) => indexOf.get(point) ?? -1);
  expect(indices).not.toContain(-1);
  for (let i = 1; i < indices.length; i++) {
    expect(indices[i]).toBeGreaterThan(indices[i - 1]);
  }
  return indices;
}

/**
 * Checks the null-gap rules against the raw source for the selection of [minX, maxX] (the
 * viewport plus one neighbour per side):
 * - every null run in the selection keeps its first and last null, plus the adjacent non-null
 *   points when they are in the selection;
 * - no two retained non-null points have a raw null between them.
 */
function expectGapRulesHold(
  source: readonly ViewportPoint[],
  result: readonly ViewportPoint[],
  minX: number,
  maxX: number
): void {
  const kept = new Set(expectOriginalSubset(source, result));
  const inside = source.flatMap((point, index) =>
    point.x >= minX && point.x <= maxX ? [index] : []
  );
  expect(inside.length).toBeGreaterThan(0);
  const selectionStart = Math.max(0, inside[0] - 1);
  const selectionEnd = Math.min(source.length - 1, inside[inside.length - 1] + 1);

  const violations: string[] = [];
  for (let i = selectionStart; i <= selectionEnd;) {
    if (source[i].y !== null) {
      i++;
      continue;
    }
    let runEnd = i;
    while (runEnd + 1 <= selectionEnd && source[runEnd + 1].y === null) runEnd++;
    const required = [i, runEnd];
    if (i - 1 >= selectionStart) required.push(i - 1);
    if (runEnd + 1 <= selectionEnd) required.push(runEnd + 1);
    for (const index of required) {
      if (!kept.has(index)) violations.push(`null run ${i}..${runEnd} lost point ${index}`);
    }
    i = runEnd + 1;
  }

  const keptIndices = [...kept].sort((a, b) => a - b);
  for (let k = 1; k < keptIndices.length; k++) {
    const a = keptIndices[k - 1];
    const b = keptIndices[k];
    if (source[a].y === null || source[b].y === null) continue;
    for (let m = a + 1; m < b; m++) {
      if (source[m].y === null) violations.push(`retained ${a} and ${b} bridge raw null ${m}`);
    }
  }
  expect(violations).toEqual([]);
}

describe('decimateViewportPoints', () => {
  describe('no-op inputs return the original array reference', () => {
    it('returns the same array when the selection is below the decimation threshold', () => {
      const points = series(10);
      const before = points.map((p) => ({ ...p }));
      const result = decimateViewportPoints(points, { minX: 0, maxX: 9, targetBucketCount: 4 });
      expect(result).toBe(points);
      expect(points).toEqual(before);
    });

    it('returns the same empty array for empty input', () => {
      const points: ViewportPoint[] = [];
      expect(decimateViewportPoints(points, { minX: 0, maxX: 1, targetBucketCount: 4 })).toBe(
        points
      );
    });

    it.each<[string, ViewportDecimationOptions]>([
      ['zero buckets', { minX: 0, maxX: 199, targetBucketCount: 0 }],
      ['negative buckets', { minX: 0, maxX: 199, targetBucketCount: -3 }],
      ['fractional buckets', { minX: 0, maxX: 199, targetBucketCount: 2.5 }],
      ['NaN buckets', { minX: 0, maxX: 199, targetBucketCount: NaN }],
      ['equal bounds', { minX: 50, maxX: 50, targetBucketCount: 10 }],
      ['reversed bounds', { minX: 199, maxX: 0, targetBucketCount: 10 }],
      ['infinite minX', { minX: -Infinity, maxX: 199, targetBucketCount: 10 }],
      ['NaN maxX', { minX: 0, maxX: NaN, targetBucketCount: 10 }],
    ])('returns the input for %s', (_label, options) => {
      const points = series(200);
      const before = points.map((p) => ({ ...p }));
      expect(decimateViewportPoints(points, options)).toBe(points);
      expect(points).toEqual(before);
    });

    it('returns the input when decimation would not shorten the selection', () => {
      // Every null is a single-point run, so every point is retained.
      const points = series(20, (i) => (i % 2 ? null : 1));
      expect(decimateViewportPoints(points, { minX: 0, maxX: 19, targetBucketCount: 2 })).toBe(
        points
      );
    });

    it('returns the full source for a narrow zoom below the threshold', () => {
      const points = series(1000, (i) => Math.sin(i));
      // Inside: 501..529 (29 points), plus neighbours 500 and 530 = 31 <= 4 * 10.
      const result = decimateViewportPoints(points, {
        minX: 500.5,
        maxX: 529.5,
        targetBucketCount: 10,
      });
      expect(result).toBe(points);
    });

    it('decimates only when the selection exceeds 4 * targetBucketCount', () => {
      const points = series(100, () => 10);
      // Inside 11..48 (38 points) plus neighbours 10 and 49 = 40 = 4 * 10: not decimated.
      expect(
        decimateViewportPoints(points, { minX: 10.5, maxX: 48.5, targetBucketCount: 10 })
      ).toBe(points);
      // Inside 11..49 (39 points) plus neighbours 10 and 50 = 41 > 40: decimated.
      const result = decimateViewportPoints(points, {
        minX: 10.5,
        maxX: 49.5,
        targetBucketCount: 10,
      });
      expect(result).not.toBe(points);
      expect(result.length).toBeLessThan(41);
      expectOriginalSubset(points, result);
    });
  });

  describe('output is a deterministic, sorted, deduplicated subset of original objects', () => {
    it('returns the same result for the same input, with no synthetic x values', () => {
      const points = series(5000, (i) => (i * 37) % 101);
      const options = { minX: 0, maxX: 4999, targetBucketCount: 50 };
      const first = decimateViewportPoints(points, options);
      const second = decimateViewportPoints(points, options);
      expect(first.length).toBeLessThan(points.length);
      expect(second).toEqual(first);
      expectOriginalSubset(points, first);
    });

    it('never mutates the input array or its points', () => {
      const points = series(3000, (i) => (i % 13 === 0 ? null : (i * 7919) % 1000));
      const before = points.map((p) => ({ ...p }));
      decimateViewportPoints(points, { minX: 0, maxX: 2999, targetBucketCount: 20 });
      expect(points).toEqual(before);
    });
  });

  describe('bucket extremes', () => {
    it('keeps first, last, min-y and max-y per bucket, ties keeping the earliest point', () => {
      // Four buckets over [0, 100): width 25. Bucket 0 = x 0..24, 1 = 25..49, 2 = 50..74, 3 = 75..99.
      const y = (i: number) => {
        if (i === 3) return -5; // bucket 0 min
        if (i === 10) return 50; // bucket 0 max
        if (i === 30) return -1; // bucket 1 min
        if (i === 40) return 99; // bucket 1 max
        return 10; // buckets 2 and 3 are all ties
      };
      const points = series(100, y);
      const result = decimateViewportPoints(points, { minX: 0, maxX: 100, targetBucketCount: 4 });
      const indices = expectOriginalSubset(points, result);
      expect(indices).toEqual([0, 3, 10, 24, 25, 30, 40, 49, 50, 74, 75, 99]);
      expect(result.map((p) => p.x)).toEqual([0, 3, 10, 24, 25, 30, 40, 49, 50, 74, 75, 99]);
    });

    it('keeps only the first and last point of a bucket when every y is equal', () => {
      const points = series(100, () => 10);
      const result = decimateViewportPoints(points, { minX: 0, maxX: 100, targetBucketCount: 4 });
      expect(expectOriginalSubset(points, result)).toEqual([0, 24, 25, 49, 50, 74, 75, 99]);
    });
  });

  describe('null gaps', () => {
    it('keeps the first and last null of an interior run and the non-null points on both sides', () => {
      const points = series(200, (i) => (i >= 60 && i <= 70 ? null : i));
      const result = decimateViewportPoints(points, { minX: 0, maxX: 199, targetBucketCount: 10 });
      const indices = expectOriginalSubset(points, result);
      expect(indices).toEqual(expect.arrayContaining([59, 60, 70, 71]));
      expect(indices).not.toContain(65);
      expectGapRulesHold(points, result, 0, 199);
    });

    it('keeps the first and last null of a leading run', () => {
      const points = series(100, (i) => (i < 5 ? null : i));
      const result = decimateViewportPoints(points, { minX: 0, maxX: 99, targetBucketCount: 5 });
      const indices = expectOriginalSubset(points, result);
      expect(indices).toEqual(expect.arrayContaining([0, 4, 5]));
      expectGapRulesHold(points, result, 0, 99);
    });

    it('keeps the first and last null of a trailing run', () => {
      const points = series(100, (i) => (i >= 95 ? null : i));
      const result = decimateViewportPoints(points, { minX: 0, maxX: 99, targetBucketCount: 5 });
      const indices = expectOriginalSubset(points, result);
      expect(indices).toEqual(expect.arrayContaining([94, 95, 99]));
      expectGapRulesHold(points, result, 0, 99);
    });

    it('keeps the clipped null run at the viewport edges', () => {
      // Run 100..140 is cut by the viewport on both sides.
      const points = series(300, (i) => (i >= 100 && i <= 140 ? null : i));
      const result = decimateViewportPoints(points, {
        minX: 120.5,
        maxX: 250.5,
        targetBucketCount: 10,
      });
      const indices = expectOriginalSubset(points, result);
      expect(indices).toEqual(expect.arrayContaining([120, 140, 141]));
      expectGapRulesHold(points, result, 120.5, 250.5);
    });

    it('treats a null as a gap, never as y = 0, for the extremes', () => {
      // If nulls were read as 0, interior nulls would become bucket minima and be kept.
      const points = series(100, (i) => (i >= 40 && i <= 60 ? null : 5 + (i % 10)));
      const result = decimateViewportPoints(points, { minX: 0, maxX: 99, targetBucketCount: 4 });
      const indices = expectOriginalSubset(points, result);
      // Interior nulls 41..59 are dropped: only the run endpoints 40 and 60 survive.
      expect(indices).toEqual(expect.arrayContaining([40, 60]));
      for (const index of [41, 45, 55, 59]) expect(indices).not.toContain(index);
      expectGapRulesHold(points, result, 0, 99);
    });

    it('holds the gap rules on random data across viewports and bucket counts', () => {
      const random = seededRandom(7);
      let inGap = false;
      const points = Array.from({ length: 3000 }, (_, i) => {
        if (random() < 0.04) inGap = !inGap;
        return { x: i, y: inGap ? null : Math.round(random() * 100) };
      });
      const viewports: [number, number][] = [
        [0, 2999],
        [100.5, 1500.25],
        [2500, 2600],
        [-10, 40],
        [1200, 1200.5],
      ];
      for (const [minX, maxX] of viewports) {
        for (const targetBucketCount of [1, 5, 37]) {
          const result = decimateViewportPoints(points, { minX, maxX, targetBucketCount });
          expectGapRulesHold(points, result, minX, maxX);
        }
      }
    });

    it('keeps only the run ends and the neighbours when the whole selection is null', () => {
      const points = series(100, () => null);
      const result = decimateViewportPoints(points, { minX: 0, maxX: 99, targetBucketCount: 5 });
      const indices = expectOriginalSubset(points, result);
      expect(indices).toEqual(expect.arrayContaining([0, 99]));
      expect(result.every((p) => p.y === null)).toBe(true);
      expect(result.length).toBeLessThan(points.length);
      expectGapRulesHold(points, result, 0, 99);
    });
  });

  describe('viewport clipping and neighbours', () => {
    it('keeps the nearest point before minX and after maxX, and nothing outside them', () => {
      const points = series(1000);
      const result = decimateViewportPoints(points, {
        minX: 300.5,
        maxX: 600.5,
        targetBucketCount: 10,
      });
      const indices = expectOriginalSubset(points, result);
      expect(indices[0]).toBe(300);
      expect(indices[indices.length - 1]).toBe(601);
      expect(result.length).toBeLessThan(302);
    });

    it('uses the points at exactly minX and maxX as inside, with neighbours outside them', () => {
      const points = series(1000);
      const result = decimateViewportPoints(points, {
        minX: 300,
        maxX: 600,
        targetBucketCount: 10,
      });
      const indices = expectOriginalSubset(points, result);
      expect(indices).toEqual(expect.arrayContaining([299, 300, 600, 601]));
      expect(indices[0]).toBe(299);
      expect(indices[indices.length - 1]).toBe(601);
    });

    it('has no before-neighbour when the viewport starts before the first point', () => {
      const points = series(1000);
      const result = decimateViewportPoints(points, {
        minX: -50,
        maxX: 500.5,
        targetBucketCount: 10,
      });
      const indices = expectOriginalSubset(points, result);
      expect(indices[0]).toBe(0);
      expect(indices[indices.length - 1]).toBe(501);
    });
  });
});

describe('nonNullYRange', () => {
  it('returns the min and max of the non-null values, never reading null as 0', () => {
    const points = [
      { x: 0, y: 50 },
      { x: 1, y: null },
      { x: 2, y: 70 },
      { x: 3, y: 60 },
    ];
    expect(nonNullYRange(points)).toEqual({ min: 50, max: 70 });
  });

  it('returns null when there are no non-null values', () => {
    expect(nonNullYRange([])).toBeNull();
    expect(
      nonNullYRange([
        { x: 0, y: null },
        { x: 1, y: null },
      ])
    ).toBeNull();
  });

  it('spans every point of the source it is given', () => {
    expect(nonNullYRange(series(5000, (i) => (i * 7919) % 1000))).toEqual({ min: 0, max: 999 });
  });
});

describe('createViewportDecimationPlugin', () => {
  const FULL_RANGE = { min: 0, max: 19999 };

  /** Fake chart with the fields the plugin reads. Options hold the live bounds. */
  function fakeChart(initialData: ViewportPoint[]) {
    const dataset = { data: initialData };
    const chart: {
      options: { scales: { x: { min?: unknown; max?: unknown } } };
      width: number;
      data: { datasets: { data: ViewportPoint[] }[] };
      update: ReturnType<typeof vi.fn>;
    } = {
      options: { scales: { x: { min: FULL_RANGE.min, max: FULL_RANGE.max } } },
      width: 800,
      data: { datasets: [dataset] },
      update: vi.fn(),
    };
    return { chart, dataset };
  }

  function runBeforeUpdate(plugin: Plugin<'line'>, chart: object): void {
    plugin.beforeUpdate?.(chart as Chart<'line'>, { mode: 'default', cancelable: true }, {});
  }

  const full = series(20000, (i) => (i * 7919) % 1000);
  const decimated = (minX: number, maxX: number, targetBucketCount: number) =>
    decimateViewportPoints(full, { minX, maxX, targetBucketCount });

  it('uses the plugin id default and a custom id when given', () => {
    expect(createViewportDecimationPlugin({ fullPoints: full }).id).toBe('viewportDecimation');
    expect(createViewportDecimationPlugin({ fullPoints: full, id: 'custom' }).id).toBe('custom');
  });

  it('replaces dataset data with the reduction of the full source and never calls update', () => {
    const snapshot = full.map((p) => ({ ...p }));
    const plugin = createViewportDecimationPlugin({ fullPoints: full });
    const { chart, dataset } = fakeChart(full);

    runBeforeUpdate(plugin, chart);

    expect(dataset.data).toEqual(decimated(0, 19999, 400));
    expect(dataset.data.length).toBeLessThan(full.length);
    expect(full).toEqual(snapshot);
    expect(chart.update).not.toHaveBeenCalled();
  });

  it('computes from the full source, not from the data currently on the dataset', () => {
    const plugin = createViewportDecimationPlugin({ fullPoints: full });
    const { chart, dataset } = fakeChart(full);
    runBeforeUpdate(plugin, chart);

    dataset.data = series(5);
    chart.options.scales.x.min = 5000;
    chart.options.scales.x.max = 9000;
    runBeforeUpdate(plugin, chart);

    expect(dataset.data).toEqual(decimated(5000, 9000, 400));
  });

  it('recomputes when the x range changes and the new points follow the zoomed range', () => {
    const plugin = createViewportDecimationPlugin({ fullPoints: full });
    const { chart, dataset } = fakeChart(full);
    runBeforeUpdate(plugin, chart);
    const fullView = dataset.data;

    chart.options.scales.x.min = 5000;
    chart.options.scales.x.max = 9000;
    runBeforeUpdate(plugin, chart);

    expect(dataset.data).not.toBe(fullView);
    const xs = dataset.data.map((p) => p.x);
    expect(xs[0]).toBe(4999);
    expect(xs[xs.length - 1]).toBe(9001);
    expect(dataset.data).toEqual(decimated(5000, 9000, 400));
  });

  it('sets the full source as data when the zoomed selection is below the threshold', () => {
    const plugin = createViewportDecimationPlugin({ fullPoints: full });
    const { chart, dataset } = fakeChart(full);
    chart.options.scales.x.min = 10000;
    chart.options.scales.x.max = 10050;

    runBeforeUpdate(plugin, chart);

    expect(dataset.data).toBe(full);
  });

  it('skips the cached reduction when the bounds are unchanged', () => {
    const plugin = createViewportDecimationPlugin({ fullPoints: full });
    const { chart, dataset } = fakeChart(full);
    runBeforeUpdate(plugin, chart);

    const sentinel: ViewportPoint[] = [];
    dataset.data = sentinel;
    runBeforeUpdate(plugin, chart);

    expect(dataset.data).toBe(sentinel);
  });

  it('recomputes when the bounds change', () => {
    const plugin = createViewportDecimationPlugin({ fullPoints: full });
    const { chart, dataset } = fakeChart(full);
    runBeforeUpdate(plugin, chart);

    const sentinel: ViewportPoint[] = [];
    dataset.data = sentinel;
    chart.options.scales.x.max = 9000;
    runBeforeUpdate(plugin, chart);

    expect(dataset.data).not.toBe(sentinel);
    expect(dataset.data).toEqual(decimated(0, 9000, 400));
  });

  it('keeps the cache when the width changes but the bucket count does not', () => {
    const plugin = createViewportDecimationPlugin({ fullPoints: full });
    const { chart, dataset } = fakeChart(full);
    runBeforeUpdate(plugin, chart);

    const sentinel: ViewportPoint[] = [];
    dataset.data = sentinel;
    // floor(801 / 2) = floor(800 / 2) = 400
    chart.width = 801;
    runBeforeUpdate(plugin, chart);

    expect(dataset.data).toBe(sentinel);
  });

  it('recomputes on resize when the canvas width changes the bucket count', () => {
    const plugin = createViewportDecimationPlugin({ fullPoints: full });
    const { chart, dataset } = fakeChart(full);
    runBeforeUpdate(plugin, chart);

    chart.width = 1000;
    runBeforeUpdate(plugin, chart);

    expect(dataset.data).toEqual(decimated(0, 19999, 500));
  });

  it('uses the canvas width for the bucket count', () => {
    const plugin = createViewportDecimationPlugin({ fullPoints: full });
    const { chart, dataset } = fakeChart(full);
    chart.width = 200;

    runBeforeUpdate(plugin, chart);

    expect(dataset.data).toEqual(decimated(0, 19999, 100));
  });

  it('restores the full source when the x range is missing, and recomputes once it is back', () => {
    const plugin = createViewportDecimationPlugin({ fullPoints: full });
    const { chart, dataset } = fakeChart(full);
    runBeforeUpdate(plugin, chart);
    expect(dataset.data).not.toBe(full);

    chart.options.scales.x.min = undefined;
    runBeforeUpdate(plugin, chart);
    expect(dataset.data).toBe(full);

    chart.options.scales.x.min = FULL_RANGE.min;
    runBeforeUpdate(plugin, chart);
    expect(dataset.data).toEqual(decimated(0, 19999, 400));
  });
});

/** Aligned data with x = index and one series per `yAt` function. */
function alignedData(n: number, ...yAt: ((i: number) => number | null)[]): AlignedSeriesData {
  const xs = Array.from({ length: n }, (_, i) => i);
  return [xs, ...yAt.map((yOf) => xs.map((_, i) => yOf(i)))] as AlignedSeriesData;
}

/**
 * Maps each output x to its source index (x values are unique in these fixtures). Fails unless the
 * output x values are strictly increasing source values, every series has the output's length, and
 * every y equals the source y at the same index.
 */
function expectAlignedSubset(source: AlignedSeriesData, result: AlignedSeriesData): number[] {
  const indexOf = new Map(source[0].map((x, index): [number, number] => [x, index]));
  const indices = result[0].map((x) => indexOf.get(x) ?? -1);
  expect(indices).not.toContain(-1);
  for (let i = 1; i < indices.length; i++) {
    expect(indices[i]).toBeGreaterThan(indices[i - 1]);
  }
  for (let s = 1; s < result.length; s++) {
    expect(result[s]).toHaveLength(result[0].length);
    result[s].forEach((y, k) => expect(y).toBe(source[s][indices[k]]));
  }
  return indices;
}

/**
 * Null-gap rules for every series, with the selection of [minX, maxX] (the viewport plus one
 * neighbour per side), as `expectGapRulesHold` checks one series:
 * - each null run in the selection keeps its first and last null, plus the adjacent non-null
 *   points that are in the selection;
 * - no two adjacent output points that are both non-null for a series have a source null
 *   between them.
 */
function expectAlignedGapRulesHold(
  source: AlignedSeriesData,
  result: AlignedSeriesData,
  minX: number,
  maxX: number
): void {
  const indices = expectAlignedSubset(source, result);
  const kept = new Set(indices);
  const xs = source[0];
  const inside = xs.flatMap((x, index) => (x >= minX && x <= maxX ? [index] : []));
  expect(inside.length).toBeGreaterThan(0);
  const selectionStart = Math.max(0, inside[0] - 1);
  const selectionEnd = Math.min(xs.length - 1, inside[inside.length - 1] + 1);

  const violations: string[] = [];
  source.slice(1).forEach((ys, s) => {
    for (let i = selectionStart; i <= selectionEnd;) {
      if (ys[i] !== null) {
        i++;
        continue;
      }
      let runEnd = i;
      while (runEnd + 1 <= selectionEnd && ys[runEnd + 1] === null) runEnd++;
      const required = [i, runEnd];
      if (i - 1 >= selectionStart) required.push(i - 1);
      if (runEnd + 1 <= selectionEnd) required.push(runEnd + 1);
      for (const index of required) {
        if (!kept.has(index)) {
          violations.push(`series ${s} null run ${i}..${runEnd} lost point ${index}`);
        }
      }
      i = runEnd + 1;
    }

    for (let k = 1; k < indices.length; k++) {
      const a = indices[k - 1];
      const b = indices[k];
      if (ys[a] === null || ys[b] === null) continue;
      for (let m = a + 1; m < b; m++) {
        if (ys[m] === null) violations.push(`series ${s}: retained ${a} and ${b} bridge null ${m}`);
      }
    }
  });
  expect(violations).toEqual([]);
}

describe('decimateAlignedViewportData', () => {
  describe('no-op inputs return the original reference', () => {
    it('returns the input when there are no x values', () => {
      const data: AlignedSeriesData = [[], []];
      expect(decimateAlignedViewportData(data, { minX: 0, maxX: 1, targetBucketCount: 4 })).toBe(
        data
      );
    });

    it('returns the input when a series length differs from the x length', () => {
      const options = { minX: 0, maxX: 199, targetBucketCount: 10 };
      const data = alignedData(
        200,
        (i) => i,
        (i) => i
      );
      const shortSeries = [data[0], data[1], data[2].slice(1)] as AlignedSeriesData;
      const shortX = [data[0].slice(1), data[1], data[2]] as AlignedSeriesData;
      expect(decimateAlignedViewportData(shortSeries, options)).toBe(shortSeries);
      expect(decimateAlignedViewportData(shortX, options)).toBe(shortX);
    });

    it.each<[string, ViewportDecimationOptions]>([
      ['zero buckets', { minX: 0, maxX: 199, targetBucketCount: 0 }],
      ['negative buckets', { minX: 0, maxX: 199, targetBucketCount: -3 }],
      ['fractional buckets', { minX: 0, maxX: 199, targetBucketCount: 2.5 }],
      ['NaN buckets', { minX: 0, maxX: 199, targetBucketCount: NaN }],
      ['equal bounds', { minX: 50, maxX: 50, targetBucketCount: 10 }],
      ['reversed bounds', { minX: 199, maxX: 0, targetBucketCount: 10 }],
      ['infinite minX', { minX: -Infinity, maxX: 199, targetBucketCount: 10 }],
      ['NaN maxX', { minX: 0, maxX: NaN, targetBucketCount: 10 }],
    ])('returns the input for %s', (_label, options) => {
      const data = alignedData(
        200,
        (i) => i,
        (i) => i % 7
      );
      const before = data.map((series) => [...series]);
      expect(decimateAlignedViewportData(data, options)).toBe(data);
      expect(data).toEqual(before);
    });

    it('returns the input below the decimation threshold', () => {
      // Selection 0..9 holds 10 points, which does not exceed 4 * 3 = 12.
      const data = alignedData(
        10,
        (i) => i,
        (i) => (i % 2 ? null : i)
      );
      expect(decimateAlignedViewportData(data, { minX: 0, maxX: 9, targetBucketCount: 3 })).toBe(
        data
      );
    });

    it('returns the input when decimation would not shorten the selection', () => {
      // Each null is a single-point run in both series, so every point is retained.
      const data = alignedData(
        20,
        (i) => (i % 2 ? null : 1),
        (i) => (i % 2 ? 1 : null)
      );
      expect(decimateAlignedViewportData(data, { minX: 0, maxX: 19, targetBucketCount: 2 })).toBe(
        data
      );
    });
  });

  describe('heavily interleaved series keep the full input', () => {
    // Series A and C are non-null at even indices, series B at odd indices. Every null run is one
    // point, so strict run preservation keeps every point and no reduction is shorter.
    const interleaved = () =>
      alignedData(
        3000,
        (i) => (i % 2 ? null : (i * 37) % 101),
        (i) => (i % 2 ? (i * 7919) % 1000 : null),
        (i) => (i % 2 ? null : 5)
      );

    it.each<[string, ViewportDecimationOptions]>([
      ['the full range', { minX: 0, maxX: 2999, targetBucketCount: 50 }],
      ['a middle range', { minX: 1000.5, maxX: 1800.5, targetBucketCount: 20 }],
      ['a fine bucket count', { minX: 0, maxX: 2999, targetBucketCount: 700 }],
    ])('returns the input reference for %s, with every gap kept', (_label, options) => {
      const data = interleaved();
      const before = data.map((series) => [...series]);
      const result = decimateAlignedViewportData(data, options);
      expect(result).toBe(data);
      expect(data).toEqual(before);
      expectAlignedGapRulesHold(data, result, options.minX, options.maxX);
    });
  });

  describe('output is an original subset with identical index alignment', () => {
    it('is deterministic, never mutates the input, and keeps source x and y values', () => {
      const data = alignedData(
        3000,
        (i) => (i * 37) % 101,
        (i) => (i % 13 === 0 ? null : (i * 7919) % 1000),
        (i) => (i * 17) % 53
      );
      const before = data.map((series) => [...series]);
      const options = { minX: 0, maxX: 2999, targetBucketCount: 50 };
      const first = decimateAlignedViewportData(data, options);
      const second = decimateAlignedViewportData(data, options);
      expect(first[0].length).toBeLessThan(data[0].length);
      expect(second).toEqual(first);
      expectAlignedSubset(data, first);
      expect(data).toEqual(before);
    });
  });

  describe('bucket extremes', () => {
    it('keeps the shared bucket first and last and each series min and max', () => {
      // Four buckets over [0, 100): width 25. Series A has its bucket 0 min at x 3 and max at x 10.
      const seriesA = (i: number) => {
        if (i === 3) return -5;
        if (i === 10) return 50;
        return 10;
      };
      const data = alignedData(100, seriesA, () => 7);
      const result = decimateAlignedViewportData(data, {
        minX: 0,
        maxX: 100,
        targetBucketCount: 4,
      });
      expect(expectAlignedSubset(data, result)).toEqual([0, 3, 10, 24, 25, 49, 50, 74, 75, 99]);
    });

    it('keeps the earliest point on a tie for the max and for the min', () => {
      // Series A is 0 except x 30 and x 40, both 99, in bucket 1 (x 25..49). Only x 30 is kept.
      const seriesA = (i: number) => (i === 30 || i === 40 ? 99 : 0);
      const data = alignedData(100, seriesA, () => 5);
      const result = decimateAlignedViewportData(data, {
        minX: 0,
        maxX: 100,
        targetBucketCount: 4,
      });
      const indices = expectAlignedSubset(data, result);
      expect(indices).toEqual([0, 24, 25, 30, 49, 50, 74, 75, 99]);
      expect(indices).not.toContain(40);
    });
  });

  describe('null gaps across several series', () => {
    const value = (i: number) => (i * 37) % 101;
    const inRange = (i: number, from: number, to: number) => i >= from && i <= to;

    it('keeps the run boundaries and neighbours of every series, with runs in different places', () => {
      const data = alignedData(
        400,
        (i) => (inRange(i, 100, 130) ? null : value(i)),
        (i) => (inRange(i, 0, 20) ? null : value(i)),
        (i) => (inRange(i, 370, 399) ? null : value(i)),
        (i) =>
          inRange(i, 50, 60) || inRange(i, 200, 210) || inRange(i, 300, 305) ? null : value(i)
      );
      const result = decimateAlignedViewportData(data, {
        minX: 0,
        maxX: 399,
        targetBucketCount: 10,
      });
      const indices = expectAlignedSubset(data, result);
      expect(indices).toEqual(expect.arrayContaining([99, 100, 130, 131]));
      expect(indices).toEqual(expect.arrayContaining([0, 20, 21]));
      expect(indices).toEqual(expect.arrayContaining([369, 370, 399]));
      expect(indices).toEqual(
        expect.arrayContaining([49, 50, 60, 61, 199, 200, 210, 211, 299, 300, 305, 306])
      );
      expectAlignedGapRulesHold(data, result, 0, 399);
    });

    it('clips a null run at the viewport edges and keeps its boundaries inside the selection', () => {
      // Run 100..140 is cut by the viewport on the left.
      const data = alignedData(
        300,
        (i) => i,
        (i) => (inRange(i, 100, 140) ? null : i)
      );
      const result = decimateAlignedViewportData(data, {
        minX: 120.5,
        maxX: 250.5,
        targetBucketCount: 10,
      });
      const indices = expectAlignedSubset(data, result);
      expect(indices).toEqual(expect.arrayContaining([120, 140, 141]));
      expectAlignedGapRulesHold(data, result, 120.5, 250.5);
    });

    it('holds the gap rules on random series across viewports and bucket counts', () => {
      const random = seededRandom(11);
      const randomSeries = (): (number | null)[] => {
        let inGap = false;
        return Array.from({ length: 3000 }, () => {
          if (random() < 0.04) inGap = !inGap;
          return inGap ? null : Math.round(random() * 100);
        });
      };
      const data = [
        Array.from({ length: 3000 }, (_, i) => i),
        randomSeries(),
        randomSeries(),
        randomSeries(),
      ] as AlignedSeriesData;
      const viewports: [number, number][] = [
        [0, 2999],
        [100.5, 1500.25],
        [2500, 2600],
        [-10, 40],
        [1200, 1200.5],
      ];
      for (const [minX, maxX] of viewports) {
        for (const targetBucketCount of [1, 5, 37]) {
          const result = decimateAlignedViewportData(data, { minX, maxX, targetBucketCount });
          expectAlignedGapRulesHold(data, result, minX, maxX);
        }
      }
    });
  });

  describe('viewport clipping and neighbours', () => {
    it('keeps the nearest point outside each side of the viewport', () => {
      const data = alignedData(
        1000,
        (i) => i,
        (i) => (i * 3) % 17
      );
      const result = decimateAlignedViewportData(data, {
        minX: 300.5,
        maxX: 600.5,
        targetBucketCount: 10,
      });
      const indices = expectAlignedSubset(data, result);
      expect(indices[0]).toBe(300);
      expect(indices[indices.length - 1]).toBe(601);
    });
  });
});

describe('alignedYRange', () => {
  const data: AlignedSeriesData = [
    [0, 1, 2, 3],
    [50, null, 70, 60],
    [1000, 2000, 3000, 4000],
  ];

  it('returns the min and max of the chosen series, never reading null as 0', () => {
    expect(alignedYRange(data, [1])).toEqual({ min: 50, max: 70 });
  });

  it('spans every chosen series', () => {
    expect(alignedYRange(data, [1, 2])).toEqual({ min: 50, max: 4000 });
  });

  it('ignores non-finite values', () => {
    const withNonFinite: AlignedSeriesData = [
      [0, 1, 2],
      [Infinity, 5, NaN],
    ];
    expect(alignedYRange(withNonFinite, [1])).toEqual({ min: 5, max: 5 });
  });

  it('returns null when the chosen series has no numeric values or none are chosen', () => {
    const empty: AlignedSeriesData = [
      [0, 1],
      [null, null],
    ];
    expect(alignedYRange(empty, [1])).toBeNull();
    expect(alignedYRange(data, [])).toBeNull();
    expect(alignedYRange(data, [9])).toBeNull();
  });
});

describe('createAlignedViewportDecimationPlugin', () => {
  const FULL_RANGE = { min: 0, max: 19999 };
  const full = alignedData(
    20000,
    (i) => (i * 7919) % 1000,
    (i) => (i % 50 < 5 ? null : (i * 31) % 997),
    (i) => (i * 13) % 211
  );

  /** Fake chart with three datasets by default. `x` holds the live bounds read from options. */
  function fakeAlignedChart(datasetCount: number) {
    const datasets = Array.from({ length: datasetCount }, () => ({
      data: [] as ViewportPoint[],
    }));
    const x: { min?: unknown; max?: unknown } = { min: FULL_RANGE.min, max: FULL_RANGE.max };
    const chart = {
      options: { scales: { x } },
      width: 800,
      data: { datasets },
      update: vi.fn(),
    };
    return { chart, datasets, x };
  }

  function runAligned(plugin: Plugin<'line'>, chart: object): void {
    plugin.beforeUpdate?.(chart as Chart<'line'>, { mode: 'default', cancelable: true }, {});
  }

  const decimatedAligned = (minX: number, maxX: number, targetBucketCount: number) =>
    decimateAlignedViewportData(full, { minX, maxX, targetBucketCount });

  it('uses the plugin id default and a custom id when given', () => {
    expect(createAlignedViewportDecimationPlugin({ fullData: full }).id).toBe(
      'alignedViewportDecimation'
    );
    expect(createAlignedViewportDecimationPlugin({ fullData: full, id: 'custom' }).id).toBe(
      'custom'
    );
  });

  it('sets every dataset to the same x sequence with its own series y, and never calls update', () => {
    const snapshot = full.map((series) => [...series]);
    const plugin = createAlignedViewportDecimationPlugin({ fullData: full });
    const { chart, datasets } = fakeAlignedChart(3);

    runAligned(plugin, chart);

    const reduced = decimatedAligned(0, 19999, 400);
    expect(reduced[0].length).toBeLessThan(full[0].length);
    const xs = datasets[0].data.map((p) => p.x);
    datasets.forEach((dataset, i) => {
      expect(dataset.data.map((p) => p.x)).toEqual(xs);
      expect(dataset.data).toEqual(toXYPoints(reduced, i + 1));
    });
    expect(full).toEqual(snapshot);
    expect(chart.update).not.toHaveBeenCalled();
  });

  it('touches no dataset when the bounds and bucket count are unchanged', () => {
    const plugin = createAlignedViewportDecimationPlugin({ fullData: full });
    const { chart, datasets } = fakeAlignedChart(3);
    runAligned(plugin, chart);

    const sentinels = datasets.map(() => [] as ViewportPoint[]);
    datasets.forEach((dataset, i) => (dataset.data = sentinels[i]));
    runAligned(plugin, chart);

    datasets.forEach((dataset, i) => expect(dataset.data).toBe(sentinels[i]));
  });

  it('recomputes every dataset on a range change, keeping the x sequences identical', () => {
    const plugin = createAlignedViewportDecimationPlugin({ fullData: full });
    const { chart, datasets, x } = fakeAlignedChart(3);
    runAligned(plugin, chart);

    x.min = 5000;
    x.max = 9000;
    runAligned(plugin, chart);

    const reduced = decimatedAligned(5000, 9000, 400);
    const xs = datasets[0].data.map((p) => p.x);
    expect(xs[0]).toBe(4999);
    expect(xs[xs.length - 1]).toBe(9001);
    datasets.forEach((dataset, i) => {
      expect(dataset.data.map((p) => p.x)).toEqual(xs);
      expect(dataset.data).toEqual(toXYPoints(reduced, i + 1));
    });
  });

  it('restores every full series when the x range is missing, and recomputes once it is back', () => {
    const plugin = createAlignedViewportDecimationPlugin({ fullData: full });
    const { chart, datasets, x } = fakeAlignedChart(3);
    runAligned(plugin, chart);

    x.min = undefined;
    runAligned(plugin, chart);
    datasets.forEach((dataset, i) => {
      expect(dataset.data).toEqual(toXYPoints(full, i + 1));
    });

    x.min = FULL_RANGE.min;
    runAligned(plugin, chart);
    expect(datasets[0].data).toEqual(toXYPoints(decimatedAligned(0, 19999, 400), 1));
  });

  it('recomputes every dataset on resize when the bucket count changes', () => {
    const plugin = createAlignedViewportDecimationPlugin({ fullData: full });
    const { chart, datasets } = fakeAlignedChart(3);
    runAligned(plugin, chart);

    chart.width = 1000;
    runAligned(plugin, chart);

    const reduced = decimatedAligned(0, 19999, 500);
    datasets.forEach((dataset, i) => {
      expect(dataset.data).toEqual(toXYPoints(reduced, i + 1));
    });
  });

  it('keeps the cache when the width changes but the bucket count does not', () => {
    const plugin = createAlignedViewportDecimationPlugin({ fullData: full });
    const { chart, datasets } = fakeAlignedChart(3);
    runAligned(plugin, chart);

    const sentinel: ViewportPoint[] = [];
    datasets[0].data = sentinel;
    // floor(801 / 2) = floor(800 / 2) = 400
    chart.width = 801;
    runAligned(plugin, chart);

    expect(datasets[0].data).toBe(sentinel);
  });

  it('does nothing when the dataset count differs from the series count', () => {
    const plugin = createAlignedViewportDecimationPlugin({ fullData: full });
    const { chart, datasets } = fakeAlignedChart(2);
    const sentinels = datasets.map(() => [] as ViewportPoint[]);
    datasets.forEach((dataset, i) => (dataset.data = sentinels[i]));

    runAligned(plugin, chart);

    datasets.forEach((dataset, i) => expect(dataset.data).toBe(sentinels[i]));
  });
});
