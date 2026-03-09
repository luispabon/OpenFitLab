const { describe, it } = require('node:test');
const { strictEqual, deepStrictEqual } = require('node:assert/strict');
const { getActivityTypes, getDevices } = require('../../../src/services/meta-service');

describe('meta-service', () => {
  describe('getActivityTypes', () => {
    it('returns distinct types from db rows in query order', async () => {
      const db = {
        query: async () => [{ type: 'Running' }, { type: 'Cycling' }, { type: 'Swimming' }],
      };
      const result = await getActivityTypes({ db, userId: 'u1' });
      deepStrictEqual(result, ['Running', 'Cycling', 'Swimming']);
    });

    it('filters out null and empty and trims', async () => {
      const db = {
        query: async () => [{ type: 'Running' }, { type: '  ' }, { type: '' }, { type: 'Cycling' }],
      };
      const result = await getActivityTypes({ db, userId: 'u1' });
      deepStrictEqual(result, ['Running', 'Cycling']);
    });

    it('returns empty array when no rows', async () => {
      const db = { query: async () => [] };
      const result = await getActivityTypes({ db, userId: 'u1' });
      deepStrictEqual(result, []);
    });
  });

  describe('getDevices', () => {
    it('returns distinct device names ordered by name', async () => {
      const db = {
        query: async () => [{ device_name: 'Garmin' }, { device_name: 'Wahoo' }],
      };
      const result = await getDevices({ db, userId: 'u1' });
      deepStrictEqual(result, ['Garmin', 'Wahoo']);
    });

    it('returns empty array when no rows', async () => {
      const db = { query: async () => [] };
      const result = await getDevices({ db, userId: 'u1' });
      deepStrictEqual(result, []);
    });
  });
});
