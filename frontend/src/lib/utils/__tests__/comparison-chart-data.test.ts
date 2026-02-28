import { describe, it, expect } from 'vitest';
import { buildComparisonChartData, type ComparisonChartEntry } from '../comparison-chart-data';

function entry(
  activityStartDate: number,
  data: { time: number; value: number }[],
  overrides?: Partial<ComparisonChartEntry>
): ComparisonChartEntry {
  return {
    eventName: 'Device',
    color: '#000',
    data: { type: 'hr', data },
    activityStartDate,
    ...overrides,
  };
}

describe('buildComparisonChartData', () => {
  describe('empty and single-entry cases', () => {
    it('returns null data for empty entries', () => {
      const result = buildComparisonChartData([], 'elapsed');
      expect(result.data).toBeNull();
      expect(result.xMin).toBe(0);
      expect(result.xMax).toBe(0);
    });

    it('returns null data when all entries have no data points', () => {
      const result = buildComparisonChartData([entry(1000, []), entry(2000, [])], 'elapsed');
      expect(result.data).toBeNull();
      expect(result.xMin).toBe(0);
      expect(result.xMax).toBe(0);
    });

    it('returns null data when entry has missing or empty data.data', () => {
      const noDataPoints = {
        eventName: 'A',
        color: '#f00',
        data: { type: 'hr', data: [] as { time: number; value: number }[] },
        activityStartDate: 1000,
      };
      const result = buildComparisonChartData([noDataPoints], 'elapsed');
      expect(result.data).toBeNull();
      expect(result.xMin).toBe(0);
      expect(result.xMax).toBe(0);
    });

    it('single entry with one point: elapsed mode gives X=0 and correct xMin/xMax', () => {
      const result = buildComparisonChartData(
        [entry(1000, [{ time: 1000, value: 80 }])],
        'elapsed'
      );
      expect(result.data).not.toBeNull();
      expect((result.data as number[][])[0]).toEqual([0]);
      expect((result.data as number[][])[1]).toEqual([80]);
      expect(result.xMin).toBe(0);
      expect(result.xMax).toBe(0);
    });

    it('single entry with multiple points: elapsed mode gives correct X and Y', () => {
      const result = buildComparisonChartData(
        [
          entry(1000, [
            { time: 1000, value: 80 },
            { time: 2000, value: 120 },
            { time: 3000, value: 90 },
          ]),
        ],
        'elapsed'
      );
      expect(result.data).not.toBeNull();
      expect((result.data as number[][])[0]).toEqual([0, 1000, 2000]);
      expect((result.data as number[][])[1]).toEqual([80, 120, 90]);
      expect(result.xMin).toBe(0);
      expect(result.xMax).toBe(2000);
    });
  });

  describe('wall-clock mode', () => {
    it('two entries use raw timestamps as X and merge into sorted union', () => {
      const result = buildComparisonChartData(
        [
          entry(1000, [
            { time: 1000, value: 80 },
            { time: 2000, value: 120 },
          ]),
          entry(5000, [
            { time: 5000, value: 90 },
            { time: 6000, value: 100 },
          ]),
        ],
        'wall-clock'
      );
      expect(result.data).not.toBeNull();
      const xs = (result.data as number[][])[0];
      expect(xs).toEqual([1000, 2000, 5000, 6000]);
      expect(result.xMin).toBe(1000);
      expect(result.xMax).toBe(6000);
      // Two Y series, each aligned to the 4 X values (with interpolation)
      expect((result.data as number[][])[1]).toHaveLength(4);
      expect((result.data as number[][])[2]).toHaveLength(4);
    });
  });

  describe('elapsed mode with per-entry origin (current behavior)', () => {
    it('two entries with same start: first series starts at 0, second at 1000', () => {
      const result = buildComparisonChartData(
        [entry(1000, [{ time: 1000, value: 80 }]), entry(1000, [{ time: 2000, value: 90 }])],
        'elapsed'
      );
      expect(result.data).not.toBeNull();
      const xs = (result.data as number[][])[0];
      expect(xs).toEqual([0, 1000]);
      // First series has value at X=0, second at X=1000 (interpolated at 0)
      expect((result.data as number[][])[1]).toHaveLength(2);
      expect((result.data as number[][])[2]).toHaveLength(2);
      expect(result.xMin).toBe(0);
      expect(result.xMax).toBe(1000);
    });
  });

  describe('non-numeric and NaN handling', () => {
    it('skips points with NaN value', () => {
      const result = buildComparisonChartData(
        [
          entry(1000, [
            { time: 1000, value: 80 },
            { time: 2000, value: NaN },
          ]),
        ],
        'elapsed'
      );
      expect(result.data).not.toBeNull();
      expect((result.data as number[][])[0]).toEqual([0]);
      expect((result.data as number[][])[1]).toEqual([80]);
    });

    it('skips points with non-number value', () => {
      const result = buildComparisonChartData(
        [
          {
            ...entry(1000, [{ time: 1000, value: 80 }]),
            data: {
              type: 'hr',
              data: [
                { time: 1000, value: 80 },
                { time: 2000, value: 'string' as unknown as number },
              ],
            },
          },
        ],
        'elapsed'
      );
      expect(result.data).not.toBeNull();
      expect((result.data as number[][])[0]).toEqual([0]);
      expect((result.data as number[][])[1]).toEqual([80]);
    });
  });

  describe('X merge and interpolation', () => {
    it('merges X from two series into sorted union and interpolates Y', () => {
      // A has elapsed X 0, 10; B has elapsed 5, 15 (same activityStartDate for simplicity)
      const result = buildComparisonChartData(
        [
          entry(0, [
            { time: 0, value: 10 },
            { time: 10000, value: 30 },
          ]),
          entry(0, [
            { time: 5000, value: 20 },
            { time: 15000, value: 40 },
          ]),
        ],
        'elapsed'
      );
      expect(result.data).not.toBeNull();
      const xs = (result.data as number[][])[0];
      expect(xs).toEqual([0, 5000, 10000, 15000]);
      expect((result.data as number[][])[1]).toHaveLength(4);
      expect((result.data as number[][])[2]).toHaveLength(4);
      // First series: exact at 0 and 10000, interpolated at 5000 and 15000
      const y1 = (result.data as number[][])[1];
      expect(y1[0]).toBe(10);
      expect(y1[2]).toBe(30);
      expect(y1[1]).toBe(20); // linear between 10 and 30 at 5000
      expect(y1[3]).toBe(30); // extrapolated from last (10000 -> 30)
    });

    it('extrapolates when one series has fewer X points', () => {
      // Series 1: only at 0 and 10; Series 2: at 0, 5, 10, 15
      const result = buildComparisonChartData(
        [
          entry(0, [
            { time: 0, value: 100 },
            { time: 10000, value: 200 },
          ]),
          entry(0, [
            { time: 0, value: 50 },
            { time: 5000, value: 60 },
            { time: 10000, value: 70 },
            { time: 15000, value: 80 },
          ]),
        ],
        'elapsed'
      );
      expect(result.data).not.toBeNull();
      const xs = (result.data as number[][])[0];
      expect(xs).toEqual([0, 5000, 10000, 15000]);
      const y1 = (result.data as number[][])[1];
      // No nulls: extrapolation fills at 5000 and 15000
      expect(y1.every((v) => v != null)).toBe(true);
      expect(y1[0]).toBe(100);
      expect(y1[2]).toBe(200);
      expect(y1[1]).toBe(150); // interpolated between 100 and 200
      expect(y1[3]).toBe(200); // extrapolated from last
    });

    it('extrapolates from first point when X is before first point of a series (rightIdx only)', () => {
      // Series 1: points at 1000, 2000 (elapsed 0, 1000); Series 2: at 0, 1000, 2000 (elapsed 0, 1000, 2000). Union X = [0, 1000, 2000]. For series 1 at x=0 we have no point -> extrapolate from first.
      const result = buildComparisonChartData(
        [
          entry(1000, [
            { time: 1000, value: 10 },
            { time: 2000, value: 20 },
          ]),
          entry(0, [
            { time: 0, value: 5 },
            { time: 1000, value: 15 },
            { time: 2000, value: 25 },
          ]),
        ],
        'elapsed'
      );
      expect(result.data).not.toBeNull();
      const xs = (result.data as number[][])[0];
      expect(xs).toEqual([0, 1000, 2000]);
      const y1 = (result.data as number[][])[1];
      // At x=0 series 1 has no point; extrapolate from first (10)
      expect(y1[0]).toBe(10);
      expect(y1[1]).toBe(10);
      expect(y1[2]).toBe(20);
    });
  });

  describe('Option A: elapsed common time origin', () => {
    it('two entries with different starts: t0 is earliest start, series align by real time', () => {
      const result = buildComparisonChartData(
        [
          entry(1000, [
            { time: 1000, value: 80 },
            { time: 2000, value: 120 },
          ]),
          entry(5000, [
            { time: 5000, value: 90 },
            { time: 6000, value: 100 },
          ]),
        ],
        'elapsed'
      );
      expect(result.data).not.toBeNull();
      const xs = (result.data as number[][])[0];
      expect(xs).toEqual([0, 1000, 4000, 5000]);
      // First series: first point at X=0, second at X=1000
      expect((result.data as number[][])[1][0]).toBe(80);
      expect((result.data as number[][])[1][1]).toBe(120);
      // Second series: first point at X=4000 (5000-1000), second at X=5000
      expect(xs[0]).toBe(0);
      expect(xs[2]).toBe(4000);
      expect(xs[3]).toBe(5000);
      expect(result.xMin).toBe(0);
      expect(result.xMax).toBe(5000);
    });

    it('three entries with different starts: t0 is earliest (500)', () => {
      const result = buildComparisonChartData(
        [
          entry(1000, [{ time: 1000, value: 10 }]),
          entry(2000, [{ time: 2000, value: 20 }]),
          entry(500, [{ time: 500, value: 5 }]),
        ],
        'elapsed'
      );
      expect(result.data).not.toBeNull();
      const xs = (result.data as number[][])[0];
      // Entry 500 → 0; 1000 → 500; 2000 → 1500
      expect(xs).toContain(0);
      expect(xs).toContain(500);
      expect(xs).toContain(1500);
      expect(xs.sort((a, b) => a - b)).toEqual([0, 500, 1500]);
    });

    it('single entry: t0 equals that entry start (unchanged behavior)', () => {
      const result = buildComparisonChartData(
        [entry(1000, [{ time: 1000, value: 80 }])],
        'elapsed'
      );
      expect(result.data).not.toBeNull();
      expect((result.data as number[][])[0]).toEqual([0]);
      expect((result.data as number[][])[1]).toEqual([80]);
      expect(result.xMin).toBe(0);
      expect(result.xMax).toBe(0);
    });
  });
});
