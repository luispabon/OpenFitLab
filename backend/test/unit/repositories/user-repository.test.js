const { describe, it } = require('node:test');
const { strictEqual, deepStrictEqual, ok } = require('node:assert/strict');
const {
  findById,
  findOrCreateByIdentity,
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

  describe('findOrCreateByIdentity', () => {
    it('creates a new user and identity when provider identity does not exist', async () => {
      const queries = [];
      const db = makeFakeDb(async (sql, params) => {
        queries.push({ sql, params });
        if (sql.includes('provider = ?') && sql.includes('provider_user_id = ?')) return [];
        if (sql.includes('LOWER(TRIM(email))')) return [];
        if (sql.includes('FROM users WHERE')) {
          return [{ id: params[0], display_name: 'Bob', avatar_url: 'http://img', created_at: new Date(), updated_at: new Date() }];
        }
        return { affectedRows: 1 };
      });

      const result = await findOrCreateByIdentity('google', 'g123', {
        displayName: 'Bob',
        avatarUrl: 'http://img',
        email: 'bob@example.com',
        emailVerified: false,
        profileData: { raw: true },
      }, { db });

      strictEqual(result.created, true);
      strictEqual(result.user.display_name, 'Bob');

      const insertUser = queries.find((q) => q.sql.includes('INSERT INTO users'));
      ok(insertUser, 'should insert into users');
      strictEqual(insertUser.params[1], 'Bob');
      strictEqual(insertUser.params[2], 'http://img');

      const insertIdentity = queries.find((q) => q.sql.includes('INSERT INTO user_identities'));
      ok(insertIdentity, 'should insert into user_identities');
      strictEqual(insertIdentity.params[2], 'google');
      strictEqual(insertIdentity.params[3], 'g123');
      strictEqual(insertIdentity.params[4], 'bob@example.com');
      deepStrictEqual(JSON.parse(insertIdentity.params[5]), { raw: true });
    });

    it('returns existing user and updates profile when provider identity exists', async () => {
      const queries = [];
      const db = makeFakeDb(async (sql, params) => {
        queries.push({ sql, params });
        if (sql.includes('provider = ?') && sql.includes('provider_user_id = ?')) return [{ user_id: 'u-existing' }];
        if (sql.includes('UPDATE users')) return { affectedRows: 1 };
        if (sql.includes('FROM users WHERE')) {
          return [{ id: 'u-existing', display_name: 'Updated', avatar_url: 'http://new', created_at: new Date(), updated_at: new Date() }];
        }
        return [];
      });

      const result = await findOrCreateByIdentity('github', 'gh456', {
        displayName: 'Updated',
        avatarUrl: 'http://new',
      }, { db });

      strictEqual(result.created, false);
      strictEqual(result.user.id, 'u-existing');
      strictEqual(result.user.display_name, 'Updated');

      const update = queries.find((q) => q.sql.includes('UPDATE users'));
      ok(update, 'should update user profile');
      strictEqual(update.params[2], 'u-existing');

      const insertUser = queries.find((q) => q.sql.includes('INSERT INTO users'));
      strictEqual(insertUser, undefined, 'should not insert a new user');
    });

    it('handles null profile fields gracefully', async () => {
      const queries = [];
      const db = makeFakeDb(async (sql, params) => {
        queries.push({ sql, params });
        if (sql.includes('provider = ?') && sql.includes('provider_user_id = ?')) return [];
        if (sql.includes('LOWER(TRIM(email))')) return [];
        if (sql.includes('FROM users WHERE')) {
          return [{ id: params[0], display_name: null, avatar_url: null, created_at: new Date(), updated_at: new Date() }];
        }
        return { affectedRows: 1 };
      });

      const result = await findOrCreateByIdentity('google', 'g999', {}, { db });

      strictEqual(result.created, true);

      const insertUser = queries.find((q) => q.sql.includes('INSERT INTO users'));
      strictEqual(insertUser.params[1], null);
      strictEqual(insertUser.params[2], null);

      const insertIdentity = queries.find((q) => q.sql.includes('INSERT INTO user_identities'));
      strictEqual(insertIdentity.params[4], null);
      strictEqual(insertIdentity.params[5], null);
    });

    it('links to existing user when verified email matches exactly one user', async () => {
      const queries = [];
      const db = makeFakeDb(async (sql, params) => {
        queries.push({ sql, params });
        if (sql.includes('provider = ?') && sql.includes('provider_user_id = ?')) return [];
        if (sql.includes('LOWER(TRIM(email))')) return [{ user_id: 'u-linked' }];
        if (sql.includes('UPDATE users')) return { affectedRows: 1 };
        if (sql.includes('FROM users WHERE')) {
          return [{ id: 'u-linked', display_name: 'Linked', avatar_url: null, created_at: new Date(), updated_at: new Date() }];
        }
        return { affectedRows: 1 };
      });

      const result = await findOrCreateByIdentity('github', 'gh-new', {
        displayName: 'Linked',
        avatarUrl: null,
        email: 'same@example.com',
        emailVerified: true,
        profileData: null,
      }, { db });

      strictEqual(result.created, false);
      strictEqual(result.user.id, 'u-linked');

      const insertUser = queries.find((q) => q.sql.includes('INSERT INTO users'));
      strictEqual(insertUser, undefined, 'should not insert a new user');

      const insertIdentity = queries.find((q) => q.sql.includes('INSERT INTO user_identities'));
      ok(insertIdentity, 'should insert new identity');
      strictEqual(insertIdentity.params[1], 'u-linked');
      strictEqual(insertIdentity.params[2], 'github');
      strictEqual(insertIdentity.params[3], 'gh-new');
      strictEqual(insertIdentity.params[4], 'same@example.com');
    });

    it('creates new user when verified email matches zero users', async () => {
      const queries = [];
      const db = makeFakeDb(async (sql, params) => {
        queries.push({ sql, params });
        if (sql.includes('provider = ?') && sql.includes('provider_user_id = ?')) return [];
        if (sql.includes('LOWER(TRIM(email))')) return [];
        if (sql.includes('FROM users WHERE')) {
          return [{ id: params[0], display_name: 'New', avatar_url: null, created_at: new Date(), updated_at: new Date() }];
        }
        return { affectedRows: 1 };
      });

      const result = await findOrCreateByIdentity('github', 'gh-other', {
        displayName: 'New',
        email: 'new@example.com',
        emailVerified: true,
      }, { db });

      strictEqual(result.created, true);
      const insertUser = queries.find((q) => q.sql.includes('INSERT INTO users'));
      ok(insertUser, 'should insert new user');
      const insertIdentity = queries.find((q) => q.sql.includes('INSERT INTO user_identities'));
      ok(insertIdentity, 'should insert new identity');
    });

    it('creates new user when email is present but not verified', async () => {
      const queries = [];
      const db = makeFakeDb(async (sql, params) => {
        queries.push({ sql, params });
        if (sql.includes('provider = ?') && sql.includes('provider_user_id = ?')) return [];
        if (sql.includes('FROM users WHERE')) {
          return [{ id: params[0], display_name: 'Unverified', avatar_url: null, created_at: new Date(), updated_at: new Date() }];
        }
        return { affectedRows: 1 };
      });

      const result = await findOrCreateByIdentity('github', 'gh-unverified', {
        displayName: 'Unverified',
        email: 'unverified@example.com',
        emailVerified: false,
      }, { db });

      strictEqual(result.created, true);
      const emailLookup = queries.find((q) => q.sql.includes('LOWER(TRIM(email))'));
      strictEqual(emailLookup, undefined, 'should not lookup by email when not verified');
    });

    it('creates new user when verified email matches more than one user', async () => {
      const queries = [];
      const db = makeFakeDb(async (sql, params) => {
        queries.push({ sql, params });
        if (sql.includes('provider = ?') && sql.includes('provider_user_id = ?')) return [];
        if (sql.includes('LOWER(TRIM(email))')) return [{ user_id: 'u1' }, { user_id: 'u2' }];
        if (sql.includes('FROM users WHERE')) {
          return [{ id: params[0], display_name: 'New', avatar_url: null, created_at: new Date(), updated_at: new Date() }];
        }
        return { affectedRows: 1 };
      });

      const result = await findOrCreateByIdentity('github', 'gh-dup', {
        displayName: 'New',
        email: 'shared@example.com',
        emailVerified: true,
      }, { db });

      strictEqual(result.created, true);
      const insertUser = queries.find((q) => q.sql.includes('INSERT INTO users'));
      ok(insertUser, 'should create new user instead of linking');
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
