const { describe, it } = require('node:test');
const { strictEqual, ok, deepStrictEqual } = require('node:assert/strict');
const {
  insertActivity,
  insertActivityStats,
  findByEventId,
  findByIdAndEventId,
  findManyByIds,
  findManyByEventIds,
  updateType,
  updateDeviceName,
  getStatsByActivityIds,
  getStatsByActivityId,
  getDistinctTypes,
  getDistinctDeviceNames,
} = require('../../../src/repositories/activity-repository');

describe('activity-repository', () => {
  describe('insertActivity', () => {
    it('inserts activity row', async () => {
      const queries = [];
      const db = {
        query: async (sql, params) => {
          queries.push({ sql, params });
          return { affectedRows: 1 };
        },
      };
      await insertActivity(
        {
          id: 'a1',
          event_id: 'e1',
          name: 'Lap 1',
          start_date: 1000,
          end_date: 2000,
          type: 'Running',
          device_name: 'Garmin',
          start_timezone: null,
          end_timezone: null,
        },
        { db }
      );
      ok(queries[0].sql.includes('INSERT INTO activities'));
      strictEqual(queries[0].params[0], 'a1');
    });
  });

  describe('insertActivityStats', () => {
    it('skips Device Names stat', async () => {
      const queries = [];
      const db = {
        query: async (sql, params) => {
          queries.push({ sql, params });
          return { affectedRows: 1 };
        },
      };
      await insertActivityStats('a1', { 'Device Names': ['Garmin'], Distance: 5000 }, { db });
      strictEqual(queries.length, 1);
      ok(!queries[0].params.join('').includes('Device Names'));
    });

    it('does not query when stats are empty', async () => {
      let queryCount = 0;
      const db = {
        query: async () => {
          queryCount++;
          return {};
        },
      };
      await insertActivityStats('a1', {}, { db });
      strictEqual(queryCount, 0);
    });
  });

  describe('findByEventId', () => {
    it('throws when opts.userId is missing', async () => {
      const db = { query: async () => [] };
      await new Promise((resolve, reject) => {
        findByEventId('e1', { db }).then(reject).catch(resolve);
      });
    });

    it('returns activities for event', async () => {
      const db = { query: async () => [{ id: 'a1', event_id: 'e1' }] };
      const result = await findByEventId('e1', { db, userId: 'u1' });
      strictEqual(result.length, 1);
      strictEqual(result[0].id, 'a1');
    });
  });

  describe('findByIdAndEventId', () => {
    it('returns null when not found', async () => {
      const db = { query: async () => [] };
      const result = await findByIdAndEventId('a1', 'e1', { db, userId: 'u1' });
      strictEqual(result, null);
    });

    it('returns activity when found', async () => {
      const db = { query: async () => [{ id: 'a1', event_id: 'e1' }] };
      const result = await findByIdAndEventId('a1', 'e1', { db, userId: 'u1' });
      strictEqual(result.id, 'a1');
    });
  });

  describe('findManyByIds', () => {
    it('returns empty array for empty ids', async () => {
      const result = await findManyByIds([], { userId: 'u1' });
      deepStrictEqual(result, []);
    });

    it('includes IN clause for ids', async () => {
      const queries = [];
      const db = {
        query: async (sql, params) => {
          queries.push({ sql, params });
          return [{ id: 'a1', event_id: 'e1' }];
        },
      };
      const result = await findManyByIds(['a1'], { db, userId: 'u1' });
      ok(queries[0].sql.includes('IN ('));
      strictEqual(result.length, 1);
    });
  });

  describe('findManyByEventIds', () => {
    it('returns empty array for empty ids', async () => {
      const result = await findManyByEventIds([], { userId: 'u1' });
      deepStrictEqual(result, []);
    });
  });

  describe('updateType', () => {
    it('executes UPDATE with type', async () => {
      const queries = [];
      const db = {
        query: async (sql, params) => {
          queries.push({ sql, params });
          return { affectedRows: 1 };
        },
      };
      await updateType('a1', 'e1', 'Cycling', { db });
      ok(queries[0].sql.includes('UPDATE activities'));
      strictEqual(queries[0].params[0], 'Cycling');
    });
  });

  describe('updateDeviceName', () => {
    it('executes UPDATE with device name', async () => {
      const queries = [];
      const db = {
        query: async (sql, params) => {
          queries.push({ sql, params });
          return { affectedRows: 1 };
        },
      };
      await updateDeviceName('a1', 'e1', 'Garmin', { db });
      ok(queries[0].sql.includes('UPDATE activities'));
      strictEqual(queries[0].params[0], 'Garmin');
    });
  });

  describe('getStatsByActivityIds', () => {
    it('returns empty array for empty ids', async () => {
      const result = await getStatsByActivityIds([], { userId: 'u1' });
      deepStrictEqual(result, []);
    });

    it('queries activity_stats with IN clause', async () => {
      const queries = [];
      const db = {
        query: async (sql, params) => {
          queries.push({ sql, params });
          return [{ activity_id: 'a1', stat_type: 'Distance', value: 5000 }];
        },
      };
      const result = await getStatsByActivityIds(['a1'], { db, userId: 'u1' });
      ok(queries[0].sql.includes('activity_stats'));
      strictEqual(result.length, 1);
    });
  });

  describe('getStatsByActivityId', () => {
    it('throws when opts.userId is missing', async () => {
      const db = { query: async () => [] };
      await new Promise((resolve, reject) => {
        getStatsByActivityId('a1', { db }).then(reject).catch(resolve);
      });
    });

    it('returns stats rows for activity', async () => {
      const db = { query: async () => [{ stat_type: 'HR', value: 140 }] };
      const result = await getStatsByActivityId('a1', { db, userId: 'u1' });
      strictEqual(result.length, 1);
    });
  });

  describe('getDistinctTypes', () => {
    it('throws when opts.userId is missing', async () => {
      const db = { query: async () => [] };
      await new Promise((resolve, reject) => {
        getDistinctTypes({ db }).then(reject).catch(resolve);
      });
    });

    it('returns distinct types', async () => {
      const db = { query: async () => [{ type: 'Running' }, { type: 'Cycling' }] };
      const result = await getDistinctTypes({ db, userId: 'u1' });
      deepStrictEqual(result, ['Running', 'Cycling']);
    });
  });

  describe('getDistinctDeviceNames', () => {
    it('throws when opts.userId is missing', async () => {
      const db = { query: async () => [] };
      await new Promise((resolve, reject) => {
        getDistinctDeviceNames({ db }).then(reject).catch(resolve);
      });
    });

    it('returns distinct device names', async () => {
      const db = { query: async () => [{ device_name: 'Garmin' }] };
      const result = await getDistinctDeviceNames({ db, userId: 'u1' });
      deepStrictEqual(result, ['Garmin']);
    });
  });
});
