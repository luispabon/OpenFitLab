const { describe, it } = require('node:test');
const { strictEqual, deepStrictEqual } = require('node:assert/strict');
const { extractStreamDataPointsFromJSON } = require('../../src/utils/stream-extractor');

const BASE_MS = 1609459200000; // 2021-01-01 00:00:00 UTC

describe('extractStreamDataPointsFromJSON', () => {
  it('returns empty array when activityJson is null', () => {
    deepStrictEqual(extractStreamDataPointsFromJSON(null, BASE_MS), []);
  });

  it('returns empty array when activityJson has no streams', () => {
    deepStrictEqual(extractStreamDataPointsFromJSON({}, BASE_MS), []);
    deepStrictEqual(extractStreamDataPointsFromJSON({ streams: null }, BASE_MS), []);
  });

  it('returns empty array for empty streams array', () => {
    deepStrictEqual(extractStreamDataPointsFromJSON({ streams: [] }, BASE_MS), []);
  });

  it('extracts array streams with Time (offsets in seconds)', () => {
    const activityJson = {
      streams: [
        { type: 'Time', data: [0, 1, 2] },
        { type: 'Heart Rate', data: [120, 130, 125] },
      ],
    };
    const result = extractStreamDataPointsFromJSON(activityJson, BASE_MS);
    strictEqual(result.length, 2);
    const timeStream = result.find((s) => s.type === 'Time');
    const hrStream = result.find((s) => s.type === 'Heart Rate');
    strictEqual(timeStream.dataPoints.length, 3);
    strictEqual(hrStream.dataPoints.length, 3);
    deepStrictEqual(
      timeStream.dataPoints.map((dp) => dp.time),
      [BASE_MS, BASE_MS + 1000, BASE_MS + 2000]
    );
    deepStrictEqual(
      hrStream.dataPoints.map((dp) => dp.value),
      [120, 130, 125]
    );
  });

  it('parses Time stream with absolute ISO timestamps', () => {
    const iso0 = '2021-01-01T00:00:00.000Z';
    const iso1 = '2021-01-01T00:00:01.000Z';
    const activityJson = {
      streams: [
        { type: 'Time', data: [iso0, iso1] },
        { type: 'Distance', data: [0, 5] },
      ],
    };
    const result = extractStreamDataPointsFromJSON(activityJson, BASE_MS);
    strictEqual(result.length, 2);
    const distStream = result.find((s) => s.type === 'Distance');
    strictEqual(distStream.dataPoints.length, 2);
    strictEqual(distStream.dataPoints[0].time, new Date(iso0).getTime());
    strictEqual(distStream.dataPoints[1].time, new Date(iso1).getTime());
  });

  it('handles object map streams format', () => {
    const activityJson = {
      streams: {
        'Heart Rate': [100, 110],
        Time: [0, 1],
      },
    };
    const result = extractStreamDataPointsFromJSON(activityJson, BASE_MS);
    strictEqual(result.length, 2);
    const hrStream = result.find((s) => s.type === 'Heart Rate');
    strictEqual(hrStream.dataPoints.length, 2);
    deepStrictEqual(
      hrStream.dataPoints.map((dp) => dp.value),
      [100, 110]
    );
    deepStrictEqual(
      hrStream.dataPoints.map((dp) => dp.time),
      [BASE_MS, BASE_MS + 1000]
    );
  });

  it('filters out null, undefined, NaN from dataPoints', () => {
    const activityJson = {
      streams: [
        { type: 'Time', data: [0, 1, 2, 3] },
        { type: 'HR', data: [100, null, undefined, 130] },
      ],
    };
    const result = extractStreamDataPointsFromJSON(activityJson, BASE_MS);
    const hrStream = result.find((s) => s.type === 'HR');
    strictEqual(hrStream.dataPoints.length, 2);
    deepStrictEqual(
      hrStream.dataPoints.map((dp) => dp.value),
      [100, 130]
    );
  });

  it('excludes stream when all values are null', () => {
    const activityJson = {
      streams: [
        { type: 'Time', data: [0, 1] },
        { type: 'Empty', data: [null, undefined] },
      ],
    };
    const result = extractStreamDataPointsFromJSON(activityJson, BASE_MS);
    strictEqual(result.length, 1);
    strictEqual(result[0].type, 'Time');
  });

  it('treats Time stream with small numbers as offsets in seconds', () => {
    const activityJson = {
      streams: [
        { type: 'Time', data: [0, 10, 20] },
        { type: 'X', data: [1, 2, 3] },
      ],
    };
    const result = extractStreamDataPointsFromJSON(activityJson, BASE_MS);
    const xStream = result.find((s) => s.type === 'X');
    deepStrictEqual(
      xStream.dataPoints.map((dp) => dp.time),
      [BASE_MS, BASE_MS + 10000, BASE_MS + 20000]
    );
  });

  it('treats Time stream with numbers > 1e12 as absolute ms', () => {
    const t0 = 1609459200000;
    const t1 = 1609459201000;
    const activityJson = {
      streams: [
        { type: 'Time', data: [t0, t1] },
        { type: 'Y', data: [1, 2] },
      ],
    };
    const result = extractStreamDataPointsFromJSON(activityJson, 0);
    const yStream = result.find((s) => s.type === 'Y');
    deepStrictEqual(
      yStream.dataPoints.map((dp) => dp.time),
      [t0, t1]
    );
  });

  it('uses 1-second interval fallback when no Time stream', () => {
    const activityJson = {
      streams: [{ type: 'Only', data: [1, 2, 3] }],
    };
    const result = extractStreamDataPointsFromJSON(activityJson, BASE_MS);
    strictEqual(result.length, 1);
    deepStrictEqual(
      result[0].dataPoints.map((dp) => dp.time),
      [BASE_MS, BASE_MS + 1000, BASE_MS + 2000]
    );
  });

  it('handles object map stream with data as object with data property', () => {
    const activityJson = {
      streams: {
        Time: [0, 1],
        Z: { data: [10, 20] },
      },
    };
    const result = extractStreamDataPointsFromJSON(activityJson, BASE_MS);
    const zStream = result.find((s) => s.type === 'Z');
    strictEqual(zStream.dataPoints.length, 2);
    deepStrictEqual(
      zStream.dataPoints.map((dp) => dp.value),
      [10, 20]
    );
  });

  it('Time stream with Date objects uses correct timestamps', () => {
    const d0 = new Date(BASE_MS);
    const d1 = new Date(BASE_MS + 1000);
    const activityJson = {
      streams: [
        { type: 'Time', data: [d0, d1] },
        { type: 'Distance', data: [0, 5] },
      ],
    };
    const result = extractStreamDataPointsFromJSON(activityJson, BASE_MS);
    strictEqual(result.length, 2);
    const timeStream = result.find((s) => s.type === 'Time');
    strictEqual(timeStream.dataPoints.length, 2);
    strictEqual(timeStream.dataPoints[0].time, BASE_MS);
    strictEqual(timeStream.dataPoints[1].time, BASE_MS + 1000);
  });

  it('non-Time stream uses timestamps from Time stream when Time has absolute Date', () => {
    const d0 = new Date(BASE_MS);
    const d1 = new Date(BASE_MS + 2000);
    const activityJson = {
      streams: [
        { type: 'Time', data: [d0, d1] },
        { type: 'Distance', data: [10, 20] },
      ],
    };
    const result = extractStreamDataPointsFromJSON(activityJson, 0);
    const distStream = result.find((s) => s.type === 'Distance');
    strictEqual(distStream.dataPoints.length, 2);
    strictEqual(distStream.dataPoints[0].time, BASE_MS);
    strictEqual(distStream.dataPoints[1].time, BASE_MS + 2000);
  });

  it('Time value not Date/string/number falls back to activityStartDateMs', () => {
    const d0 = new Date(BASE_MS);
    const activityJson = {
      streams: [
        { type: 'Time', data: [d0, {}] },
        { type: 'X', data: [1, 2] },
      ],
    };
    const result = extractStreamDataPointsFromJSON(activityJson, BASE_MS);
    const timeStream = result.find((s) => s.type === 'Time');
    strictEqual(timeStream.dataPoints[0].time, BASE_MS);
    strictEqual(timeStream.dataPoints[1].time, BASE_MS);
    const xStream = result.find((s) => s.type === 'X');
    strictEqual(xStream.dataPoints[0].time, BASE_MS);
    strictEqual(xStream.dataPoints[1].time, BASE_MS);
  });
});
