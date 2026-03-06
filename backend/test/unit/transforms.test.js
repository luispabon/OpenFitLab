const { describe, it } = require('node:test');
const { strictEqual, deepStrictEqual, throws } = require('node:assert/strict');
const {
  parseJSONField,
  toTimestamp,
  aggregateStats,
  mapEventRow,
  mapActivityRow,
  placeholders,
} = require('../../src/utils/transforms');

describe('parseJSONField', () => {
  it('returns defaultValue for null', () => {
    strictEqual(parseJSONField(null, 'default'), 'default');
  });

  it('returns defaultValue for undefined', () => {
    strictEqual(parseJSONField(undefined, 42), 42);
  });

  it('returns object as-is when value is already an object', () => {
    const obj = { a: 1 };
    strictEqual(parseJSONField(obj), obj);
  });

  it('parses JSON string', () => {
    deepStrictEqual(parseJSONField('{"x":1}'), { x: 1 });
  });

  it('throws on invalid JSON string', () => {
    throws(
      () => parseJSONField('not json'),
      (err) => err instanceof SyntaxError
    );
  });

  it('uses null as default when not provided', () => {
    strictEqual(parseJSONField(null), null);
    strictEqual(parseJSONField(undefined), null);
  });
});

describe('toTimestamp', () => {
  it('returns defaultValue for null', () => {
    strictEqual(toTimestamp(null, 0), 0);
  });

  it('returns defaultValue for undefined', () => {
    strictEqual(toTimestamp(undefined, null), null);
  });

  it('returns getTime() for Date', () => {
    const d = new Date(1609459200000);
    strictEqual(toTimestamp(d), 1609459200000);
  });

  it('returns number as-is', () => {
    strictEqual(toTimestamp(1234567890), 1234567890);
  });

  it('parses numeric string', () => {
    strictEqual(toTimestamp('1609459200000'), 1609459200000);
  });

  it('returns defaultValue for NaN string', () => {
    strictEqual(toTimestamp('abc', 999), 999);
  });

  it('uses null as default when not provided', () => {
    strictEqual(toTimestamp(null), null);
  });
});

describe('aggregateStats', () => {
  it('returns empty object for non-array', () => {
    deepStrictEqual(aggregateStats(null), {});
    deepStrictEqual(aggregateStats(undefined), {});
  });

  it('returns empty object for empty array', () => {
    deepStrictEqual(aggregateStats([]), {});
  });

  it('aggregates single row with keyField', () => {
    const rows = [{ event_id: 'e1', stat_type: 'Distance', value: 5000 }];
    deepStrictEqual(aggregateStats(rows, 'event_id'), {
      e1: { Distance: 5000 },
    });
  });

  it('aggregates multiple rows with keyField', () => {
    const rows = [
      { event_id: 'e1', stat_type: 'Distance', value: 5000 },
      { event_id: 'e1', stat_type: 'Duration', value: 1800 },
      { event_id: 'e2', stat_type: 'Distance', value: 3000 },
    ];
    deepStrictEqual(aggregateStats(rows, 'event_id'), {
      e1: { Distance: 5000, Duration: 1800 },
      e2: { Distance: 3000 },
    });
  });

  it('aggregates without keyField (flat)', () => {
    const rows = [
      { stat_type: 'Distance', value: 5000 },
      { stat_type: 'Duration', value: 1800 },
    ];
    deepStrictEqual(aggregateStats(rows), {
      Distance: 5000,
      Duration: 1800,
    });
  });

  it('skips rows with null key when keyField present', () => {
    const rows = [
      { event_id: null, stat_type: 'Distance', value: 5000 },
      { event_id: 'e1', stat_type: 'Duration', value: 100 },
    ];
    deepStrictEqual(aggregateStats(rows, 'event_id'), {
      e1: { Duration: 100 },
    });
  });

  it('parses JSON value when value is string', () => {
    const rows = [{ event_id: 'e1', stat_type: 'x', value: '{"n":1}' }];
    deepStrictEqual(aggregateStats(rows, 'event_id'), { e1: { x: { n: 1 } } });
  });
});

describe('mapEventRow', () => {
  it('maps minimal row', () => {
    const row = { id: 'e1', start_date: 1609459200000, name: 'Run' };
    deepStrictEqual(mapEventRow(row), {
      id: 'e1',
      startDate: 1609459200000,
      name: 'Run',
      stats: {},
    });
  });

  it('maps full row with optional fields', () => {
    const row = {
      id: 'e1',
      start_date: 1609459200000,
      name: 'Run',
      end_date: 1609462800000,
      description: 'Morning run',
      is_merge: 1,
      src_file_type: 'tcx',
      start_timezone: 'UTC',
      end_timezone: 'UTC',
    };
    const stats = { Distance: 5000 };
    deepStrictEqual(mapEventRow(row, stats), {
      id: 'e1',
      startDate: 1609459200000,
      name: 'Run',
      endDate: 1609462800000,
      description: 'Morning run',
      isMerge: true,
      stats: { Distance: 5000 },
      srcFileType: 'tcx',
      startTimezone: 'UTC',
      endTimezone: 'UTC',
    });
  });

  it('omits optional fields when null/undefined', () => {
    const row = { id: 'e1', start_date: 0, name: null };
    const result = mapEventRow(row);
    strictEqual('endDate' in result, false);
    strictEqual('description' in result, false);
    strictEqual('isMerge' in result, false);
    strictEqual('srcFileType' in result, false);
    strictEqual('startTimezone' in result, false);
    strictEqual('endTimezone' in result, false);
  });
});

describe('mapActivityRow', () => {
  it('maps minimal row', () => {
    const row = { id: 'a1', event_id: 'e1' };
    const result = mapActivityRow(row);
    deepStrictEqual(result, {
      id: 'a1',
      eventID: 'e1',
      stats: {},
    });
  });

  it('maps full row with all optional fields', () => {
    const row = {
      id: 'a1',
      event_id: 'e1',
      name: 'Lap 1',
      start_date: 1609459200000,
      end_date: 1609462800000,
      type: 'Running',
      device_name: 'Garmin',
      start_timezone: 'America/New_York',
      end_timezone: 'America/New_York',
    };
    const stats = { 'Heart Rate': 140 };
    deepStrictEqual(mapActivityRow(row, stats), {
      id: 'a1',
      eventID: 'e1',
      name: 'Lap 1',
      startDate: 1609459200000,
      endDate: 1609462800000,
      type: 'Running',
      stats: { 'Heart Rate': 140 },
      deviceName: 'Garmin',
      startTimezone: 'America/New_York',
      endTimezone: 'America/New_York',
    });
  });

  it('omits optional fields when null', () => {
    const row = { id: 'a1', event_id: 'e1' };
    const result = mapActivityRow(row);
    strictEqual('name' in result, false);
    strictEqual('startDate' in result, false);
    strictEqual('type' in result, false);
    strictEqual('deviceName' in result, false);
    strictEqual('startTimezone' in result, false);
    strictEqual('endTimezone' in result, false);
  });
});

describe('placeholders', () => {
  it('returns one placeholder for count 1', () => {
    strictEqual(placeholders(1), '?');
  });

  it('returns comma-separated placeholders for count 3', () => {
    strictEqual(placeholders(3), '?,?,?');
  });

  it('returns empty string for count 0', () => {
    strictEqual(placeholders(0), '');
  });
});
