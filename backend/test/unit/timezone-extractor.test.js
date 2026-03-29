const { describe, it } = require('node:test');
const { strictEqual, deepStrictEqual } = require('node:assert/strict');
const {
  extractTimezone,
  extractTimezoneFromValue,
  extractActivityTimezones,
} = require('../../src/utils/timezone-extractor');

describe('extractTimezoneFromValue', () => {
  it('returns null for null and undefined', () => {
    strictEqual(extractTimezoneFromValue(null), null);
    strictEqual(extractTimezoneFromValue(undefined), null);
  });

  it('returns UTC for ISO string with Z', () => {
    strictEqual(extractTimezoneFromValue('2024-01-15T14:30:00Z'), 'UTC');
  });

  it('returns UTC for ISO string with +00:00', () => {
    strictEqual(extractTimezoneFromValue('2024-01-15T14:30:00+00:00'), 'UTC');
  });

  it('returns UTC for ISO string with -00:00', () => {
    strictEqual(extractTimezoneFromValue('2024-01-15T14:30:00-00:00'), 'UTC');
  });

  it('returns null for ISO string with non-UTC offset', () => {
    strictEqual(extractTimezoneFromValue('2024-01-15T14:30:00-05:00'), null);
    strictEqual(extractTimezoneFromValue('2024-01-15T14:30:00+01:00'), null);
  });

  it('returns null for Date object', () => {
    strictEqual(extractTimezoneFromValue(new Date()), null);
  });

  it('returns null for number', () => {
    strictEqual(extractTimezoneFromValue(1609459200000), null);
  });
});

describe('extractTimezone', () => {
  it('returns same result as extractTimezoneFromValue', () => {
    strictEqual(extractTimezone('2024-01-15T14:30:00Z'), 'UTC');
    strictEqual(extractTimezone(null), null);
  });
});

describe('extractActivityTimezones', () => {
  it('returns nulls for null or non-object', () => {
    deepStrictEqual(extractActivityTimezones(null), {
      startTimezone: null,
      endTimezone: null,
    });
    deepStrictEqual(extractActivityTimezones(undefined), {
      startTimezone: null,
      endTimezone: null,
    });
    deepStrictEqual(extractActivityTimezones('not an object'), {
      startTimezone: null,
      endTimezone: null,
    });
  });

  it('extracts UTC from ISO Z strings in startDate and endDate', () => {
    deepStrictEqual(
      extractActivityTimezones({
        startDate: '2024-01-15T08:00:00Z',
        endDate: '2024-01-15T09:00:00Z',
      }),
      { startTimezone: 'UTC', endTimezone: 'UTC' }
    );
  });

  it('returns null for startDate/endDate as numbers', () => {
    deepStrictEqual(
      extractActivityTimezones({
        startDate: 1705312800000,
        endDate: 1705316400000,
      }),
      { startTimezone: null, endTimezone: null }
    );
  });

  it('omits null when only one date has timezone', () => {
    const result = extractActivityTimezones({
      startDate: '2024-01-15T08:00:00Z',
      endDate: 1705316400000,
    });
    strictEqual(result.startTimezone, 'UTC');
    strictEqual(result.endTimezone, null);
  });

  it('prefers explicit startTimezone and endTimezone when set', () => {
    deepStrictEqual(
      extractActivityTimezones({
        startDate: 1705312800000,
        endDate: 1705316400000,
        startTimezone: 'Europe/London',
        endTimezone: 'Europe/London',
      }),
      { startTimezone: 'Europe/London', endTimezone: 'Europe/London' }
    );
  });
});
