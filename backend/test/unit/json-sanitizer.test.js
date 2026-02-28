const { describe, it } = require('node:test');
const { deepStrictEqual } = require('node:assert/strict');
const JSONSanitizer = require('../../src/utils/json-sanitizer');

const knownTypes = new Set(['Distance', 'Duration', 'Heart Rate', 'Speed', 'Time']);
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

  it('sanitizeStats omits stat type when getDataClassFromDataType throws and adds to unknownTypes', () => {
    const getDataClassThrows = (type) => {
      if (type === 'ThrowingStat') throw new Error('Unknown data type');
      return knownTypes.has(type) ? {} : null;
    };
    const input = { stats: { Distance: 5000, ThrowingStat: 99, 'Heart Rate': 140 } };
    const result = JSONSanitizer.sanitize(input, { getDataClassFromDataType: getDataClassThrows });
    deepStrictEqual(result.sanitizedJson.stats, { Distance: 5000, 'Heart Rate': 140 });
    deepStrictEqual(result.unknownTypes.sort(), ['ThrowingStat']);
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

  it('sanitizeStreams array keeps entry that has no type', () => {
    const input = {
      activities: [
        {
          id: 'a1',
          streams: [{ data: [1] }, { type: 'Distance', data: [2] }],
        },
      ],
    };
    const result = JSONSanitizer.sanitize(input, { getDataClassFromDataType: mockGetDataClass });
    deepStrictEqual(result.sanitizedJson.activities[0].streams, [
      { data: [1] },
      { type: 'Distance', data: [2] },
    ]);
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

  it('sanitizeStreams object removes key when getDataClassFromDataType throws and adds to unknownTypes', () => {
    const getDataClassThrows = (type) => {
      if (type === 'ThrowingStream') throw new Error('Unknown stream type');
      return knownTypes.has(type) ? {} : null;
    };
    const input = {
      activities: [
        {
          id: 'a1',
          streams: { 'Heart Rate': [100], ThrowingStream: [1] },
        },
      ],
    };
    const result = JSONSanitizer.sanitize(input, { getDataClassFromDataType: getDataClassThrows });
    deepStrictEqual(result.sanitizedJson.activities[0].streams, { 'Heart Rate': [100] });
    deepStrictEqual(result.unknownTypes.sort(), ['ThrowingStream']);
  });

  it('sanitizeStreams leaves streams unchanged when null or non-array non-object', () => {
    const inputNull = { activities: [{ id: 'a1', streams: null }] };
    const resultNull = JSONSanitizer.sanitize(inputNull, {
      getDataClassFromDataType: mockGetDataClass,
    });
    deepStrictEqual(resultNull.sanitizedJson.activities[0].streams, null);

    const inputNumber = { activities: [{ id: 'a1', streams: 42 }] };
    const resultNumber = JSONSanitizer.sanitize(inputNumber, {
      getDataClassFromDataType: mockGetDataClass,
    });
    deepStrictEqual(resultNumber.sanitizedJson.activities[0].streams, 42);
  });

  it('uses real sports-lib when no getDataClassFromDataType option (integration)', () => {
    // No options: production path using DynamicDataLoader.getDataClassFromDataType
    const input = {
      stats: { Distance: 5000, Duration: 1800, 'Heart Rate': 140 },
      activities: [
        {
          id: 'a1',
          stats: { Speed: 2.5, Altitude: 100 },
          streams: [
            { type: 'Heart Rate', data: [120, 125] },
            { type: 'Speed', data: [2.0, 2.5] },
          ],
        },
      ],
    };
    const result = JSONSanitizer.sanitize(input);
    deepStrictEqual(result.unknownTypes, []);
    deepStrictEqual(result.sanitizedJson.stats, {
      Distance: 5000,
      Duration: 1800,
      'Heart Rate': 140,
    });
    deepStrictEqual(result.sanitizedJson.activities.length, 1);
    deepStrictEqual(result.sanitizedJson.activities[0].stats, { Speed: 2.5, Altitude: 100 });
    deepStrictEqual(result.sanitizedJson.activities[0].streams, [
      { type: 'Heart Rate', data: [120, 125] },
      { type: 'Speed', data: [2.0, 2.5] },
    ]);
  });
});
