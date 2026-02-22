const { describe, it } = require('node:test');
const { deepStrictEqual } = require('node:assert/strict');
const JSONSanitizer = require('../../src/utils/json-sanitizer');

const knownTypes = new Set(['Distance', 'Duration', 'Heart Rate', 'Speed', 'Time']);
function mockGetDataClass(type) {
  return knownTypes.has(type) ? {} : null;
}
function mockGetDataClass(type) {
  return knownTypes.has(type) ? {} : null;
}

describe('JSONSanitizer.sanitize', () => {
  it('returns input and empty unknownTypes for null', () => {
    const result = JSONSanitizer.sanitize(null, { getDataClassFromDataType: mockGetDataClass });
    deepStrictEqual(result, { sanitizedJson: null, unknownTypes: [] });
  });

  it('returns input and empty unknownTypes for undefined', () => {
    const result = JSONSanitizer.sanitize(undefined, {
      getDataClassFromDataType: mockGetDataClass,
    });
    deepStrictEqual(result, { sanitizedJson: undefined, unknownTypes: [] });
  });

  it('passes through empty object', () => {
    const input = {};
    const result = JSONSanitizer.sanitize(input, { getDataClassFromDataType: mockGetDataClass });
    deepStrictEqual(result.sanitizedJson, {});
    deepStrictEqual(result.unknownTypes, []);
  });

  it('keeps stats with valid types', () => {
    const input = { stats: { Distance: 5000, Duration: 1800, 'Heart Rate': 140 } };
    const result = JSONSanitizer.sanitize(input, { getDataClassFromDataType: mockGetDataClass });
    deepStrictEqual(result.sanitizedJson.stats, { Distance: 5000, Duration: 1800, 'Heart Rate': 140 });
    deepStrictEqual(result.unknownTypes, []);
  });

  it('filters stats with unknown type and adds to unknownTypes', () => {
    const input = { stats: { Distance: 5000, UnknownStat: 99, 'Heart Rate': 140 } };
    const result = JSONSanitizer.sanitize(input, { getDataClassFromDataType: mockGetDataClass });
    deepStrictEqual(result.sanitizedJson.stats, { Distance: 5000, 'Heart Rate': 140 });
    deepStrictEqual(result.unknownTypes.sort(), ['UnknownStat']);
  });

  it('filters out null, undefined, NaN from stats', () => {
    const input = { stats: { Distance: 5000, NullVal: null, NanVal: NaN, Undef: undefined } };
    const result = JSONSanitizer.sanitize(input, { getDataClassFromDataType: mockGetDataClass });
    deepStrictEqual(result.sanitizedJson.stats, { Distance: 5000 });
  });

  it('defaults activity missing laps, events, intensityZones to []', () => {
    const input = { activities: [{ id: 'a1' }] };
    const result = JSONSanitizer.sanitize(input, { getDataClassFromDataType: mockGetDataClass });
    deepStrictEqual(result.sanitizedJson.activities[0].laps, []);
    deepStrictEqual(result.sanitizedJson.activities[0].events, []);
    deepStrictEqual(result.sanitizedJson.activities[0].intensityZones, []);
  });

  it('defaults activity missing stats to {}', () => {
    const input = { activities: [{ id: 'a1' }] };
    const result = JSONSanitizer.sanitize(input, { getDataClassFromDataType: mockGetDataClass });
    deepStrictEqual(result.sanitizedJson.activities[0].stats, {});
  });

  it('sanitizes laps stats recursively', () => {
    const input = {
      activities: [
        {
          id: 'a1',
          laps: [{ stats: { Distance: 1000, UnknownLap: 1 } }],
        },
      ],
    };
    const result = JSONSanitizer.sanitize(input, { getDataClassFromDataType: mockGetDataClass });
    deepStrictEqual(result.sanitizedJson.activities[0].laps[0].stats, { Distance: 1000 });
    deepStrictEqual(result.unknownTypes.sort(), ['UnknownLap']);
  });

  it('filters streams array by unknown type', () => {
    const input = {
      activities: [
        {
          id: 'a1',
          streams: [
            { type: 'Heart Rate', data: [100] },
            { type: 'CustomField', data: [1] },
          ],
        },
      ],
    };
    const result = JSONSanitizer.sanitize(input, { getDataClassFromDataType: mockGetDataClass });
    deepStrictEqual(result.sanitizedJson.activities[0].streams, [
      { type: 'Heart Rate', data: [100] },
    ]);
    // Implementation only adds to unknownTypes when getDataClassFromDataType throws; falsy return just filters out
    deepStrictEqual(result.unknownTypes, []);
  });

  it('removes unknown type keys from streams object map', () => {
    const input = {
      activities: [
        {
          id: 'a1',
          streams: {
            'Heart Rate': [100],
            UnknownStream: [1],
          },
        },
      ],
    };
    const result = JSONSanitizer.sanitize(input, { getDataClassFromDataType: mockGetDataClass });
    deepStrictEqual(result.sanitizedJson.activities[0].streams, { 'Heart Rate': [100] });
    deepStrictEqual(result.unknownTypes, ['UnknownStream']);
  });
});
