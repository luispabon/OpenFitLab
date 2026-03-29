const { describe, it, mock, afterEach } = require('node:test');
const { strictEqual, deepStrictEqual, ok } = require('node:assert/strict');
const {
  parseStravaTimezone,
  mapActivityType,
  stravaStreamsToCanonicalMap,
  normalizeStravaToCanonical,
  stravaGet,
} = require('../../../src/integrations/strava-driver');
const { StravaTokenExpiredError, StravaRateLimitError } = require('../../../src/errors');

describe('strava-driver', () => {
  describe('parseStravaTimezone', () => {
    it('extracts IANA suffix from Strava timezone string', () => {
      strictEqual(parseStravaTimezone('(GMT+00:00) Europe/London'), 'Europe/London');
    });
    it('returns null for empty', () => {
      strictEqual(parseStravaTimezone(''), null);
      strictEqual(parseStravaTimezone(null), null);
    });
  });

  describe('mapActivityType', () => {
    it('maps known sport_type to OpenFitLab type', () => {
      strictEqual(mapActivityType({ sport_type: 'Run' }), 'Running');
      strictEqual(mapActivityType({ sport_type: 'Ride' }), 'Cycling');
    });
    it('returns Other for unknown sport_type', () => {
      strictEqual(mapActivityType({ sport_type: 'FooBarUnknown' }), 'Other');
    });
  });

  describe('stravaStreamsToCanonicalMap', () => {
    it('maps Strava stream keys to extractor-friendly names', () => {
      const m = stravaStreamsToCanonicalMap([
        { type: 'time', data: [0, 1, 2] },
        { type: 'heartrate', data: [120, 121] },
        { type: 'latlng', data: [
            [51.5, -0.1],
            [51.51, -0.11],
          ] },
      ]);
      deepStrictEqual(m.Time, [0, 1, 2]);
      deepStrictEqual(m['Heart Rate'], [120, 121]);
      strictEqual(m.Position.length, 2);
      deepStrictEqual(m.Position[0], { lat: 51.5, lng: -0.1 });
    });
  });

  describe('normalizeStravaToCanonical', () => {
    it('builds eventJson and single activity for persistParsedEvent', () => {
      const start = '2024-01-15T08:00:00Z';
      const { eventJson, activitiesData } = normalizeStravaToCanonical(
        {
          id: 12345,
          name: 'Morning Run',
          start_date: start,
          elapsed_time: 3600,
          moving_time: 3500,
          distance: 10000,
          sport_type: 'Run',
          timezone: '(GMT+00:00) Europe/London',
          device_name: 'Garmin',
        },
        [{ type: 'time', data: [0, 1] }]
      );
      strictEqual(eventJson.name, 'Morning Run');
      ok(typeof eventJson.startDate === 'number');
      strictEqual(activitiesData.length, 1);
      strictEqual(activitiesData[0].activityJson.type, 'Running');
      strictEqual(activitiesData[0].activityJson.startTimezone, 'Europe/London');
      strictEqual(activitiesData[0].activityJson.creator.name, 'Garmin');
      ok(activitiesData[0].activityJson.streams.Time);
    });
  });

  describe('stravaGet', () => {
    afterEach(() => {
      mock.restoreAll();
    });

    it('throws StravaTokenExpiredError on 401', async () => {
      mock.method(globalThis, 'fetch', async () => ({
        ok: false,
        status: 401,
        headers: new Map(),
        text: async () => '',
      }));
      await new Promise((resolve, reject) => {
        stravaGet('token', '/athlete')
          .then(reject)
          .catch((e) => {
            ok(e instanceof StravaTokenExpiredError);
            resolve();
          });
      });
    });

    it('throws StravaRateLimitError on 429', async () => {
      mock.method(globalThis, 'fetch', async () => ({
        ok: false,
        status: 429,
        headers: new Map([['retry-after', '120']]),
        text: async () => '',
      }));
      await new Promise((resolve, reject) => {
        stravaGet('token', '/athlete')
          .then(reject)
          .catch((e) => {
            ok(e instanceof StravaRateLimitError);
            strictEqual(e.retryAfterSeconds, 120);
            resolve();
          });
      });
    });
  });
});
