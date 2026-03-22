const { describe, it } = require('node:test');
const { strictEqual, deepStrictEqual, ok } = require('node:assert/strict');
const {
  buildUnifiedTimeline,
  resolveValue,
  buildTrackpoints,
} = require('../../../src/utils/trackpoint-builder');

describe('buildUnifiedTimeline', () => {
  it('returns sorted union of all stream timestamps', () => {
    const streamMap = {
      'Heart Rate': [
        { time: 3000, value: 120 },
        { time: 1000, value: 100 },
      ],
      Distance: [
        { time: 2000, value: 50 },
        { time: 1000, value: 0 },
      ],
    };
    deepStrictEqual(buildUnifiedTimeline(streamMap), [1000, 2000, 3000]);
  });

  it('returns empty array for empty streamMap', () => {
    deepStrictEqual(buildUnifiedTimeline({}), []);
  });

  it('handles single stream correctly', () => {
    const streamMap = {
      HR: [
        { time: 5000, value: 130 },
        { time: 3000, value: 125 },
      ],
    };
    deepStrictEqual(buildUnifiedTimeline(streamMap), [3000, 5000]);
  });

  it('handles streams with completely non-overlapping timestamps', () => {
    const streamMap = {
      A: [{ time: 1000, value: 1 }],
      B: [{ time: 2000, value: 2 }],
    };
    deepStrictEqual(buildUnifiedTimeline(streamMap), [1000, 2000]);
  });
});

describe('resolveValue', () => {
  it('returns null for empty stream', () => {
    strictEqual(resolveValue([], 1000), null);
    strictEqual(resolveValue(null, 1000), null);
  });

  it('returns value for exact match', () => {
    const stream = [
      { time: 1000, value: 100 },
      { time: 2000, value: 200 },
    ];
    strictEqual(resolveValue(stream, 1000), 100);
    strictEqual(resolveValue(stream, 2000), 200);
  });

  it('returns nearest value within default tolerance', () => {
    const stream = [
      { time: 1000, value: 100 },
      { time: 5000, value: 200 },
    ];
    // 1100ms is 100ms from 1000 vs 3900ms from 5000
    strictEqual(resolveValue(stream, 1100), 100);
  });

  it('returns null when nearest is beyond default tolerance (30s)', () => {
    const stream = [{ time: 1000, value: 100 }];
    strictEqual(resolveValue(stream, 1000 + 31000), null);
  });

  it('returns value when nearest is exactly at tolerance boundary', () => {
    const stream = [{ time: 1000, value: 100 }];
    strictEqual(resolveValue(stream, 1000 + 30000), 100);
  });

  it('respects custom tolerance', () => {
    const stream = [{ time: 1000, value: 100 }];
    strictEqual(resolveValue(stream, 1000 + 5000, 3000), null);
    strictEqual(resolveValue(stream, 1000 + 5000, 10000), 100);
  });
});

describe('buildTrackpoints', () => {
  it('returns empty array for empty streamMap', () => {
    deepStrictEqual(buildTrackpoints({}), []);
  });

  it('produces one entry per unique timestamp', () => {
    const streamMap = {
      A: [{ time: 1000, value: 1 }],
      B: [{ time: 2000, value: 2 }],
    };
    const result = buildTrackpoints(streamMap);
    strictEqual(result.length, 2);
    strictEqual(result[0].timeMs, 1000);
    strictEqual(result[1].timeMs, 2000);
  });

  it('handles single stream correctly', () => {
    const streamMap = {
      Speed: [
        { time: 1000, value: 5.5 },
        { time: 2000, value: 6.0 },
      ],
    };
    const result = buildTrackpoints(streamMap);
    strictEqual(result.length, 2);
    strictEqual(result[0].streams['Speed'], 5.5);
    strictEqual(result[1].streams['Speed'], 6.0);
  });

  it('omits stream values beyond tolerance for non-overlapping timestamps', () => {
    // Gap of 59s — beyond the 30s default tolerance
    const streamMap = {
      HR: [{ time: 1000, value: 100 }],
      Distance: [{ time: 60000, value: 50 }],
    };
    const result = buildTrackpoints(streamMap);
    strictEqual(result.length, 2);
    ok('HR' in result[0].streams);
    ok(!('Distance' in result[0].streams));
    ok('Distance' in result[1].streams);
    ok(!('HR' in result[1].streams));
  });

  it('includes stream values within tolerance at adjacent timestamps', () => {
    // Gap of 5s — within the 30s default tolerance
    const streamMap = {
      HR: [{ time: 1000, value: 100 }],
      Speed: [{ time: 6000, value: 3.5 }],
    };
    const result = buildTrackpoints(streamMap);
    strictEqual(result.length, 2);
    ok('HR' in result[0].streams);
    ok('Speed' in result[0].streams); // 5s away — within tolerance
  });
});
