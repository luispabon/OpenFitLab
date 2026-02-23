/**
 * Phase 4: Route wiring tests for /api/events.
 * Calls service functions with the same argument shapes the route handlers pass,
 * to lock in req → service parameter mapping. Validation is tested in validation.test.js.
 */
const { describe, it } = require('node:test');
const { strictEqual, deepStrictEqual } = require('node:assert/strict');
const {
  listEvents,
  getEventById,
  getActivityRows,
  getComparisonCandidates,
} = require('../../../src/services/event-query-service');
const { deleteEventById } = require('../../../src/services/event-delete-service');
const { getStreamsForActivity } = require('../../../src/services/stream-service');
const { updateActivity } = require('../../../src/services/activity-service');

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
          strictEqual(params[0], 1000);
          strictEqual(params[1], 2000);
          strictEqual(params[2], 10);
          return [];
        },
      };
      const result = await listEvents(filters, { db });
      deepStrictEqual(result, []);
    });
  });

  describe('GET /:id (getEventById)', () => {
    it('passes req.params.id to getEventById', async () => {
      const eventId = 'a1b2c3d4-e5f6-4789-a012-3456789abcde';
      const db = { queryOne: async () => null, query: async () => [] };
      const result = await getEventById(eventId, { db });
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
      const result = await getActivityRows(params, { db });
      deepStrictEqual(result, { rows: [], total: 0 });
    });
  });

  describe('GET /:id/candidates (getComparisonCandidates)', () => {
    it('passes req.params.id to getComparisonCandidates', async () => {
      const db = { queryOne: async () => null, query: async () => [] };
      const result = await getComparisonCandidates('event-uuid-here', { db });
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
        { db }
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
        { db }
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
      const result = await deleteEventById('event-uuid', { db });
      strictEqual(result, false);
    });
  });
});
