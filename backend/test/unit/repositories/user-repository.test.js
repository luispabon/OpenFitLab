const { describe, it } = require('node:test');
const { strictEqual, ok } = require('node:assert/strict');
const {
  findById,
  deleteById,
  findIdentityByProvider,
  findIdentitiesByEmail,
  linkIdentity,
  createFromPendingProfile,
} = require('../../../src/repositories/user-repository');
const { makeFakeDb } = require('../../helpers/fake-db');

describe('user-repository', () => {
  describe('findById', () => {
    it('returns user when found', async () => {
      const user = { id: 'u1', display_name: 'Alice', avatar_url: null, created_at: new Date(), updated_at: new Date() };
      const db = { query: async () => [user] };

      const result = await findById('u1', { db });

      strictEqual(result.id, 'u1');
      strictEqual(result.display_name, 'Alice');
    });

    it('returns null when not found', async () => {
      const db = { query: async () => [] };

      const result = await findById('missing', { db });

      strictEqual(result, null);
    });
  });

  describe('deleteById', () => {
    it('returns true when user is deleted', async () => {
      const db = { query: async () => ({ affectedRows: 1 }) };

      const result = await deleteById('u1', { db });

      strictEqual(result, true);
    });

    it('returns false when user does not exist', async () => {
      const db = { query: async () => ({ affectedRows: 0 }) };

      const result = await deleteById('missing', { db });

      strictEqual(result, false);
    });
  });

  describe('findIdentityByProvider', () => {
    it('returns identity when found', async () => {
      const db = { query: async () => [{ user_id: 'u1' }] };

      const result = await findIdentityByProvider('google', 'g123', { db });

      strictEqual(result.user_id, 'u1');
    });

    it('returns null when not found', async () => {
      const db = { query: async () => [] };

      const result = await findIdentityByProvider('google', 'missing', { db });

      strictEqual(result, null);
    });
  });

  describe('findIdentitiesByEmail', () => {
    it('returns rows when email matches', async () => {
      const db = { query: async () => [{ user_id: 'u1' }] };

      const result = await findIdentitiesByEmail('alice@example.com', { db });

      strictEqual(result.length, 1);
      strictEqual(result[0].user_id, 'u1');
    });

    it('returns empty array when no match', async () => {
      const db = { query: async () => [] };

      const result = await findIdentitiesByEmail('nobody@example.com', { db });

      strictEqual(result.length, 0);
    });
  });

  describe('linkIdentity', () => {
    it('inserts identity and updates user profile', async () => {
      const queries = [];
      const db = {
        query: async (sql, params) => {
          queries.push({ sql, params });
          if (sql.includes('INSERT INTO user_identities')) return { affectedRows: 1 };
          if (sql.includes('UPDATE users')) return { affectedRows: 1 };
          return [];
        },
      };

      const result = await linkIdentity('u1', {
        provider: 'github',
        providerUserId: 'gh456',
        email: 'user@example.com',
        displayName: 'Alice',
        avatarUrl: 'http://avatar',
      }, { db });

      ok(result.id);

      const insertIdentity = queries.find((q) => q.sql.includes('INSERT INTO user_identities'));
      ok(insertIdentity);
      strictEqual(insertIdentity.params[1], 'u1');
      strictEqual(insertIdentity.params[2], 'github');
      strictEqual(insertIdentity.params[3], 'gh456');
      strictEqual(insertIdentity.params[4], 'user@example.com');
      strictEqual(insertIdentity.params[5], null);

      const updateUser = queries.find((q) => q.sql.includes('UPDATE users'));
      ok(updateUser);
      strictEqual(updateUser.params[0], 'Alice');
      strictEqual(updateUser.params[1], 'http://avatar');
      strictEqual(updateUser.params[2], 'u1');
    });
  });

  describe('createFromPendingProfile', () => {
    it('creates user and identity in transaction with profile_data null', async () => {
      const queries = [];
      const db = makeFakeDb(async (sql, params) => {
        queries.push({ sql, params });
        if (sql.includes('INSERT INTO users')) return { affectedRows: 1 };
        if (sql.includes('INSERT INTO user_identities')) return { affectedRows: 1 };
        if (sql.includes('FROM users WHERE')) {
          return [{ id: params[0], display_name: 'New', avatar_url: null, created_at: new Date(), updated_at: new Date() }];
        }
        return [];
      });

      const result = await createFromPendingProfile({
        provider: 'google',
        providerUserId: 'g789',
        displayName: 'New',
        avatarUrl: 'http://img',
        email: 'new@example.com',
        emailVerified: true,
      }, { db });

      strictEqual(result.created, true);
      strictEqual(result.user.display_name, 'New');

      const insertUser = queries.find((q) => q.sql.includes('INSERT INTO users'));
      ok(insertUser);
      strictEqual(insertUser.params[1], 'New');
      strictEqual(insertUser.params[2], 'http://img');

      const insertIdentity = queries.find((q) => q.sql.includes('INSERT INTO user_identities'));
      ok(insertIdentity);
      strictEqual(insertIdentity.params[2], 'google');
      strictEqual(insertIdentity.params[3], 'g789');
      strictEqual(insertIdentity.params[5], null, 'profile_data should be null');
    });
  });
});
