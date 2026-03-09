/**
 * Phase 4: Route wiring tests for /api/events.
 * Calls service functions with the same argument shapes the route handlers pass,
 * to lock in req → service parameter mapping. Validation is tested in validation.test.js.
 * HTTP handler tests (Stage 4) mount the router and assert status/body via supertest.
 */
const { describe, it } = require('node:test');
const { strictEqual, deepStrictEqual, ok } = require('node:assert/strict');
const { mock } = require('node:test');
const request = require('supertest');
const express = require('express');
const {
  listEvents,
  getEventById,
  getActivityRows,
  getComparisonCandidates,
} = require('../../../src/services/event-query-service');
const { deleteEventById } = require('../../../src/services/event-delete-service');
const { getStreamsForActivity } = require('../../../src/services/stream-service');
const { updateActivity } = require('../../../src/services/activity-service');
const { processUpload } = require('../../../src/services/event-upload-service');
const eventsRouterModule = require('../../../src/routes/events');
const { buildUploadResults } = eventsRouterModule;
const { errorHandler } = require('../../../src/middleware/error-handler');
const fs = require('fs');
const path = require('path');

const FIXTURES_DIR = path.join(__dirname, '..', '..', 'fixtures');
const EVENTS_ROUTER_PATH = require.resolve('../../../src/routes/events');

const EVENT_ID = 'a1b2c3d4-e5f6-4789-a012-3456789abcde';
const ACTIVITY_ID = 'b2c3d4e5-f6a7-4890-b123-456789abcdef';

const eventQueryService = require('../../../src/services/event-query-service');
const eventDeleteService = require('../../../src/services/event-delete-service');
const streamService = require('../../../src/services/stream-service');
const activityService = require('../../../src/services/activity-service');

/** Minimal app that mounts events router with req.userId set (no real auth). */
function createEventsApp(router) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.userId = 'u1';
    next();
  });
  app.use('/api/events', router);
  app.use(errorHandler);
  return app;
}

/** Re-require the events router so it picks up current (mocked) service exports. */
function getFreshEventsRouter() {
  delete require.cache[EVENTS_ROUTER_PATH];
  return require('../../../src/routes/events');
}

describe('Events route → service parameter mapping', () => {
  describe('GET / (listEvents)', () => {
    it('passes startDate, endDate, limit from query (route shape)', async () => {
      const query = { startDate: '1000', endDate: '2000', limit: '10' };
      const filters = {
        startDate: query.startDate != null ? Number(query.startDate) : undefined,
        endDate: query.endDate != null ? Number(query.endDate) : undefined,
        limit: query.limit,
      };
      const db = {
        query: async (sql, params) => {
          strictEqual(params[0], 'u1');
          strictEqual(params[1], 1000);
          strictEqual(params[2], 2000);
          strictEqual(params[3], 10);
          return [];
        },
      };
      const result = await listEvents(filters, { db, userId: 'u1' });
      deepStrictEqual(result, []);
    });
  });

  describe('GET /:id (getEventById)', () => {
    it('passes req.params.id to getEventById', async () => {
      const eventId = 'a1b2c3d4-e5f6-4789-a012-3456789abcde';
      const db = { queryOne: async () => null, query: async () => [] };
      const result = await getEventById(eventId, { db, userId: 'u1' });
      strictEqual(result, null);
    });
  });

  describe('GET /activity-rows (getActivityRows)', () => {
    it('passes limit, offset, startDate, endDate, activityTypes, devices, search from query', async () => {
      const query = {
        limit: '20',
        offset: '0',
        startDate: '1000',
        endDate: '2000',
        activityTypes: ['Running', 'Cycling'],
        devices: 'Garmin',
        search: 'morning',
      };
      const params = {
        limit: query.limit,
        offset: query.offset,
        startDate: query.startDate != null ? Number(query.startDate) : undefined,
        endDate: query.endDate != null ? Number(query.endDate) : undefined,
        activityTypes: query.activityTypes,
        devices: query.devices,
        search: query.search,
      };
      const db = { query: async (sql) => (sql.includes('COUNT') ? [{ total: 0 }] : []) };
      const result = await getActivityRows(params, { db, userId: 'u1' });
      deepStrictEqual(result, { rows: [], total: 0 });
    });
  });

  describe('GET /:id/candidates (getComparisonCandidates)', () => {
    it('passes req.params.id to getComparisonCandidates', async () => {
      const db = { queryOne: async () => null, query: async () => [] };
      const result = await getComparisonCandidates('event-uuid-here', { db, userId: 'u1' });
      strictEqual(result, null);
    });
  });

  describe('GET /:id/activities/:activityId/streams (getStreamsForActivity)', () => {
    it('passes eventId, activityId, and options.types from query.types (array or single)', async () => {
      const eventId = 'e1';
      const activityId = 'a1';
      const queryTypes = ['Heart Rate', 'Distance'];
      const types = queryTypes
        ? Array.isArray(queryTypes)
          ? queryTypes
          : [queryTypes]
        : undefined;
      const db = { query: async () => [] };
      const result = await getStreamsForActivity(eventId, activityId, types ? { types } : {}, {
        db,
        userId: 'u1',
      });
      deepStrictEqual(result, []);
    });
  });

  describe('PATCH /:id/activities/:activityId (updateActivity)', () => {
    it('passes eventId, activityId, { type, deviceName } from params and body', async () => {
      const eventId = 'e1';
      const activityId = 'a1';
      const body = { type: 'Running', deviceName: 'Garmin' };
      const db = {
        queryOne: async () => null,
        transaction: async () => {},
        query: async () => [],
      };
      const result = await updateActivity(
        eventId,
        activityId,
        { type: body.type, deviceName: body.deviceName },
        { db, userId: 'u1' }
      );
      strictEqual(result, null);
    });
  });

  describe('DELETE /:id (deleteEventById)', () => {
    it('passes req.params.id to deleteEventById', async () => {
      const queryFn = async (sql) => {
        if (sql.includes('FROM comparisons')) return [];
        return { affectedRows: 0 };
      };
      const db = {
        query: queryFn,
        transaction: async (fn) => {
          const fakeConn = {
            execute: async (sql, params) => {
              const result = await queryFn(sql, params);
              return [result];
            },
          };
          return fn(fakeConn);
        },
      };
      const result = await deleteEventById('event-uuid', { db, userId: 'u1' });
      strictEqual(result, false);
    });
  });

  describe('POST / (batch upload)', () => {
    const fakeDb = {
      transaction: async (fn) => fn({ execute: async () => [{}] }),
    };
    const processUploadWithFakeDb = (buffer, extension, filename, opts) =>
      processUpload(buffer, extension, filename, { ...opts, db: fakeDb });

    it('one file yields { results: [ one success item ] }', async () => {
      const tcxPath = path.join(FIXTURES_DIR, 'minimal.tcx');
      const buffer = fs.readFileSync(tcxPath);
      const files = [{ buffer, originalname: 'minimal.tcx' }];
      const results = await buildUploadResults(files, 'u1', processUploadWithFakeDb);
      strictEqual(results.length, 1);
      strictEqual(results[0].success, true);
      strictEqual(results[0].filename, 'minimal.tcx');
      strictEqual(typeof results[0].id, 'string');
      ok(results[0].event);
      ok(Array.isArray(results[0].activities));
    });

    it('two files yield two success results', async () => {
      const tcxPath = path.join(FIXTURES_DIR, 'minimal.tcx');
      const buffer = fs.readFileSync(tcxPath);
      const files = [
        { buffer, originalname: 'first.tcx' },
        { buffer, originalname: 'second.tcx' },
      ];
      const results = await buildUploadResults(files, 'u1', processUploadWithFakeDb);
      strictEqual(results.length, 2);
      strictEqual(results[0].success, true);
      strictEqual(results[0].filename, 'first.tcx');
      strictEqual(results[1].success, true);
      strictEqual(results[1].filename, 'second.tcx');
    });

    it('unsupported extension yields success: false and error', async () => {
      const files = [{ buffer: Buffer.from('x'), originalname: 'noext' }];
      const results = await buildUploadResults(files, 'u1', processUploadWithFakeDb);
      strictEqual(results.length, 1);
      strictEqual(results[0].success, false);
      strictEqual(results[0].filename, 'noext');
      strictEqual(results[0].error, 'Unsupported file type');
    });

    it('processUpload throw yields success: false with error message', async () => {
      const failingProcessUpload = async () => {
        throw new Error('Parse failed');
      };
      const files = [{ buffer: Buffer.from('x'), originalname: 'a.tcx' }];
      const results = await buildUploadResults(files, 'u1', failingProcessUpload);
      strictEqual(results.length, 1);
      strictEqual(results[0].success, false);
      strictEqual(results[0].filename, 'a.tcx');
      strictEqual(results[0].error, 'Parse failed');
    });
  });
});

describe('Events route HTTP handler coverage', () => {
  it('GET / returns 200 and listEvents result', async () => {
    mock.method(eventQueryService, 'listEvents', async () => [{ id: 'e1', name: 'Event 1' }]);
    try {
      const router = getFreshEventsRouter();
      const app = createEventsApp(router);
      const res = await request(app)
        .get('/api/events')
        .query({ startDate: 1, endDate: 2, limit: '5' })
        .expect(200);
      deepStrictEqual(res.body, [{ id: 'e1', name: 'Event 1' }]);
    } finally {
      eventQueryService.listEvents.mock.restore();
      delete require.cache[EVENTS_ROUTER_PATH];
    }
  });

  it('GET /activity-rows returns 200 and getActivityRows result', async () => {
    mock.method(eventQueryService, 'getActivityRows', async () => ({
      rows: [{ event: {}, activity: {} }],
      total: 1,
    }));
    try {
      const router = getFreshEventsRouter();
      const app = createEventsApp(router);
      const res = await request(app)
        .get('/api/events/activity-rows')
        .query({ limit: 10, offset: 0 })
        .expect(200);
      strictEqual(res.body.rows.length, 1);
      strictEqual(res.body.total, 1);
    } finally {
      eventQueryService.getActivityRows.mock.restore();
      delete require.cache[EVENTS_ROUTER_PATH];
    }
  });

  it('GET /:id/candidates returns 404 when getComparisonCandidates returns null', async () => {
    mock.method(eventQueryService, 'getComparisonCandidates', async () => null);
    try {
      const router = getFreshEventsRouter();
      const app = createEventsApp(router);
      const res = await request(app).get(`/api/events/${EVENT_ID}/candidates`).expect(404);
      deepStrictEqual(res.body, { error: 'Event not found' });
    } finally {
      eventQueryService.getComparisonCandidates.mock.restore();
      delete require.cache[EVENTS_ROUTER_PATH];
    }
  });

  it('GET /:id returns 404 when getEventById returns null', async () => {
    mock.method(eventQueryService, 'getEventById', async () => null);
    try {
      const router = getFreshEventsRouter();
      const app = createEventsApp(router);
      const res = await request(app).get(`/api/events/${EVENT_ID}`).expect(404);
      deepStrictEqual(res.body, { error: 'Event not found' });
    } finally {
      eventQueryService.getEventById.mock.restore();
      delete require.cache[EVENTS_ROUTER_PATH];
    }
  });

  it('POST / returns 400 when no files provided', async () => {
    const router = getFreshEventsRouter();
    const app = createEventsApp(router);
    const res = await request(app).post('/api/events').expect(400);
    deepStrictEqual(res.body, { error: 'No files provided' });
    delete require.cache[EVENTS_ROUTER_PATH];
  });

  it('GET streams with types array returns 200 and getStreamsForActivity result', async () => {
    mock.method(streamService, 'getStreamsForActivity', async (_e, _a, opts) => {
      deepStrictEqual(opts.types, ['Heart Rate', 'Distance']);
      return [{ type: 'Heart Rate', data: [] }];
    });
    try {
      const router = getFreshEventsRouter();
      const app = createEventsApp(router);
      const res = await request(app)
        .get(`/api/events/${EVENT_ID}/activities/${ACTIVITY_ID}/streams`)
        .query({ types: ['Heart Rate', 'Distance'] })
        .expect(200);
      strictEqual(res.body.length, 1);
      strictEqual(res.body[0].type, 'Heart Rate');
    } finally {
      streamService.getStreamsForActivity.mock.restore();
      delete require.cache[EVENTS_ROUTER_PATH];
    }
  });

  it('GET streams with single types returns 200 and passes types as array', async () => {
    mock.method(streamService, 'getStreamsForActivity', async (_e, _a, opts) => {
      deepStrictEqual(opts.types, ['HR']);
      return [];
    });
    try {
      const router = getFreshEventsRouter();
      const app = createEventsApp(router);
      await request(app)
        .get(`/api/events/${EVENT_ID}/activities/${ACTIVITY_ID}/streams`)
        .query({ types: 'HR' })
        .expect(200);
    } finally {
      streamService.getStreamsForActivity.mock.restore();
      delete require.cache[EVENTS_ROUTER_PATH];
    }
  });

  it('PATCH activity returns 400 when body lacks type and deviceName', async () => {
    const router = getFreshEventsRouter();
    const app = createEventsApp(router);
    const res = await request(app)
      .patch(`/api/events/${EVENT_ID}/activities/${ACTIVITY_ID}`)
      .send({})
      .expect(400);
    deepStrictEqual(res.body, {
      error: 'Provide at least one of type or deviceName',
    });
    delete require.cache[EVENTS_ROUTER_PATH];
  });

  it('PATCH activity returns 404 when updateActivity returns null', async () => {
    mock.method(activityService, 'updateActivity', async () => null);
    try {
      const router = getFreshEventsRouter();
      const app = createEventsApp(router);
      const res = await request(app)
        .patch(`/api/events/${EVENT_ID}/activities/${ACTIVITY_ID}`)
        .send({ type: 'Running' })
        .expect(404);
      deepStrictEqual(res.body, { error: 'Activity not found' });
    } finally {
      activityService.updateActivity.mock.restore();
      delete require.cache[EVENTS_ROUTER_PATH];
    }
  });

  it('DELETE /:id returns 204 when event deleted', async () => {
    mock.method(eventDeleteService, 'deleteEventById', async () => true);
    try {
      const router = getFreshEventsRouter();
      const app = createEventsApp(router);
      await request(app).delete(`/api/events/${EVENT_ID}`).expect(204);
    } finally {
      eventDeleteService.deleteEventById.mock.restore();
      delete require.cache[EVENTS_ROUTER_PATH];
    }
  });

  it('DELETE /:id returns 404 when event not found', async () => {
    mock.method(eventDeleteService, 'deleteEventById', async () => false);
    try {
      const router = getFreshEventsRouter();
      const app = createEventsApp(router);
      const res = await request(app).delete(`/api/events/${EVENT_ID}`).expect(404);
      deepStrictEqual(res.body, { error: 'Event not found' });
    } finally {
      eventDeleteService.deleteEventById.mock.restore();
      delete require.cache[EVENTS_ROUTER_PATH];
    }
  });
});
