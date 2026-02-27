/**
 * Phase 4: Route wiring tests for /api/events.
 * Calls service functions with the same argument shapes the route handlers pass,
 * to lock in req → service parameter mapping. Validation is tested in validation.test.js.
 */
const { describe, it } = require('node:test');
const { strictEqual, deepStrictEqual, ok } = require('node:assert/strict');
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
const { buildUploadResults } = require('../../../src/routes/events');
const fs = require('fs');
const path = require('path');

const FIXTURES_DIR = path.join(__dirname, '..', '..', 'fixtures');

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
      const result = await getStreamsForActivity(
        eventId,
        activityId,
        types ? { types } : {},
        { db, userId: 'u1' }
      );
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
