import { describe, it, expect, vi } from 'vitest';
import type { Chart, Plugin } from 'chart.js';
import {
  createViewportDecimationPlugin,
  decimateViewportPoints,
  nonNullYRange,
  type ViewportDecimationOptions,
  type ViewportPoint,
} from '../viewport-decimation';

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
