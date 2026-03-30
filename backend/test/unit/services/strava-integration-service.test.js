const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const { strictEqual, ok } = require('node:assert/strict');
const { mock } = require('node:test');
const driver = require('../../../src/integrations/strava-driver');
const eventPersistence = require('../../../src/services/event-persistence');
const eventRepository = require('../../../src/repositories/event-repository');
const folderRepository = require('../../../src/repositories/folder-repository');
const { StravaTokenExpiredError, NotFoundError } = require('../../../src/errors');

const STRAVA_INTEGRATION_PATH = require.resolve('../../../src/services/strava-integration-service');

function loadStravaIntegrationService() {
  delete require.cache[STRAVA_INTEGRATION_PATH];
  return require('../../../src/services/strava-integration-service');
}

function futureSession() {
  return {
    integrations: {
      strava: {
        accessToken: 'tok',
        expiresAt: Date.now() + 3600000,
      },
    },
  };
}

describe('strava-integration-service', () => {
  const restores = [];

  afterEach(() => {
    for (const r of restores) {
      try {
        r.mock.restore();
      } catch {
        /* */
      }
    }
    restores.length = 0;
    delete require.cache[STRAVA_INTEGRATION_PATH];
  });

  it('stravaConnectionStatus: not connected without token', () => {
    const { stravaConnectionStatus } = loadStravaIntegrationService();
    const st = stravaConnectionStatus({});
    strictEqual(st.connected, false);
  });

  it('stravaConnectionStatus: connected with valid token', () => {
    const { stravaConnectionStatus } = loadStravaIntegrationService();
    const st = stravaConnectionStatus(futureSession());
    strictEqual(st.connected, true);
  });

  it('listStravaActivitiesForUser requires opts.userId', async () => {
    const { listStravaActivitiesForUser } = loadStravaIntegrationService();
    await assert.rejects(
      () => listStravaActivitiesForUser(futureSession(), {}, {}),
      (e) => e.message.includes('userId')
    );
  });

  it('listStravaActivitiesForUser maps activities and import flags', async () => {
    restores.push(
      mock.method(driver, 'listActivities', async () => [
        {
          id: 42,
          name: 'Morning Run',
          start_date: '2020-01-01T10:00:00Z',
          type: 'Run',
          sport_type: 'Run',
          distance: 5000,
          moving_time: 1800,
        },
      ])
    );
    restores.push(
      mock.method(eventRepository, 'findImportKeyMap', async () => {
        const m = new Map();
        m.set('42', 'event-uuid');
        return m;
      })
    );
    const { listStravaActivitiesForUser } = loadStravaIntegrationService();
    const out = await listStravaActivitiesForUser(futureSession(), {}, { userId: 'u1' });
    strictEqual(out.length, 1);
    strictEqual(out[0].id, '42');
    strictEqual(out[0].alreadyImported, true);
    strictEqual(out[0].eventId, 'event-uuid');
  });

  it('requireStravaAccessToken throws StravaTokenExpiredError when disconnected', async () => {
    const { importStravaActivitiesByExternalIds } = loadStravaIntegrationService();
    await assert.rejects(
      () => importStravaActivitiesByExternalIds(['1'], null, {}, { userId: 'u1' }),
      (e) => e instanceof StravaTokenExpiredError
    );
  });

  it('importStravaActivitiesByExternalIds throws NotFoundError for missing folder', async () => {
    restores.push(mock.method(folderRepository, 'findById', async () => null));
    const { importStravaActivitiesByExternalIds } = loadStravaIntegrationService();
    await assert.rejects(
      () =>
        importStravaActivitiesByExternalIds(['1'], 'bad-folder', futureSession(), {
          userId: 'u1',
        }),
      (e) => e instanceof NotFoundError
    );
  });

  it('importStravaActivitiesByExternalIds persists and returns success', async () => {
    restores.push(
      mock.method(driver, 'fetchActivityBundle', async () => ({
        detail: { id: 1, name: 'Run', type: 'Run', start_date: '2020-01-01T10:00:00Z' },
        streams: [],
      }))
    );
    restores.push(
      mock.method(driver, 'normalizeStravaToCanonical', () => ({
        eventJson: {
          name: 'Run',
          startDate: new Date('2020-01-01').toISOString(),
          stats: {},
        },
        activitiesData: [
          {
            activityJson: {
              name: 'Segment',
              stats: {},
              streams: {},
              startDate: new Date('2020-01-01').toISOString(),
            },
          },
        ],
      }))
    );
    restores.push(
      mock.method(eventPersistence, 'persistParsedEvent', async () => ({ eventId: 'new-ev' }))
    );
    restores.push(
      mock.method(eventRepository, 'findImportKeyMap', async () => new Map())
    );
    const { importStravaActivitiesByExternalIds } = loadStravaIntegrationService();
    const out = await importStravaActivitiesByExternalIds(['99'], null, futureSession(), {
      userId: 'u1',
    });
    strictEqual(out.results.length, 1);
    strictEqual(out.results[0].success, true);
    strictEqual(out.results[0].eventId, 'new-ev');
  });

  it('importStravaActivitiesByExternalIds skips duplicate in request', async () => {
    restores.push(
      mock.method(driver, 'fetchActivityBundle', async () => ({
        detail: { id: 1, name: 'Run', type: 'Run', start_date: '2020-01-01T10:00:00Z' },
        streams: [],
      }))
    );
    restores.push(
      mock.method(driver, 'normalizeStravaToCanonical', () => ({
        eventJson: {
          name: 'Run',
          startDate: new Date('2020-01-01').toISOString(),
          stats: {},
        },
        activitiesData: [
          {
            activityJson: {
              name: 'Segment',
              stats: {},
              streams: {},
              startDate: new Date('2020-01-01').toISOString(),
            },
          },
        ],
      }))
    );
    restores.push(
      mock.method(eventPersistence, 'persistParsedEvent', async () => ({ eventId: 'new-ev' }))
    );
    restores.push(
      mock.method(eventRepository, 'findImportKeyMap', async () => new Map())
    );
    const { importStravaActivitiesByExternalIds } = loadStravaIntegrationService();
    const out = await importStravaActivitiesByExternalIds(['1', '1'], null, futureSession(), {
      userId: 'u1',
    });
    strictEqual(out.results.length, 2);
    strictEqual(out.results[0].success, true);
    strictEqual(out.results[1].success, false);
    ok(out.results[1].error.includes('Duplicate'));
  });
});
