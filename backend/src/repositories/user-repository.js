const { randomUUID } = require('node:crypto');
const { runQuery, runQueryOne } = require('./query-helper');
const { normalizeEmail } = require('../utils/email');

async function findById(id, opts = {}) {
  return runQueryOne(
    'SELECT id, display_name, avatar_url, created_at, updated_at FROM users WHERE id = ?',
    [id],
    opts
  );
}

async function deleteById(id, opts = {}) {
  const result = await runQuery('DELETE FROM users WHERE id = ?', [id], opts);
  return result && result.affectedRows === 1;
}

/**
 * Find identity by provider and provider user ID.
 * @returns {{ user_id: string } | null}
 */
async function findIdentityByProvider(provider, providerUserId, opts = {}) {
  return runQueryOne(
    'SELECT user_id FROM user_identities WHERE provider = ? AND provider_user_id = ?',
    [provider, providerUserId],
    opts
  );
}

/**
 * Find identities for a user (for export). Excludes profile_data for privacy.
 * @returns {Array<{ id: string, provider: string, provider_user_id: string, email: string | null, created_at: string }>}
 */
async function findIdentitiesByUserId(userId, opts = {}) {
  const rows = await runQuery(
    'SELECT id, provider, provider_user_id, email, created_at FROM user_identities WHERE user_id = ?',
    [userId],
    opts
  );
  return Array.isArray(rows) ? rows : [];
}

/**
 * Find identities by email (for account linking). Returns distinct user_id rows.
 * @returns {Array<{ user_id: string }>}
 */
async function findIdentitiesByEmail(email, opts = {}) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return [];
  const rows = await runQuery(
    'SELECT DISTINCT user_id FROM user_identities WHERE LOWER(TRIM(email)) = ? AND email IS NOT NULL',
    [normalizedEmail],
    opts
  );
  return Array.isArray(rows) ? rows : [];
}

/**
 * Link a new identity to an existing user. Updates user display_name and avatar_url if provided.
 * @param {string} userId
 * @param {{ provider: string, providerUserId: string, email?: string | null, profileData?: object | null, displayName?: string | null, avatarUrl?: string | null }} identity
 */
async function linkIdentity(userId, identity, opts = {}) {
  const identityId = randomUUID();
  await runQuery(
    'INSERT INTO user_identities (id, user_id, provider, provider_user_id, email, profile_data) VALUES (?, ?, ?, ?, ?, ?)',
    [
      identityId,
      userId,
      identity.provider,
      identity.providerUserId,
      identity.email ?? null,
      identity.profileData ? JSON.stringify(identity.profileData) : null,
    ],
    opts
  );
  await runQuery(
    'UPDATE users SET display_name = COALESCE(?, display_name), avatar_url = COALESCE(?, avatar_url) WHERE id = ?',
    [identity.displayName ?? null, identity.avatarUrl ?? null, userId],
    opts
  );
  return { id: identityId };
}

/**
 * Create a new user and identity from pending profile (no profileData stored).
 * @param {{ provider: string, providerUserId: string, displayName?: string | null, avatarUrl?: string | null, email?: string | null, emailVerified?: boolean }} profile
 */
async function createFromPendingProfile(profile, opts = {}) {
  const db = opts.db ?? require('../db');

  return db.transaction(async (conn) => {
    const txOpts = { ...opts, db, conn };

    const userId = randomUUID();
    const identityId = randomUUID();
    const normalizedEmail = normalizeEmail(profile.email);

    await runQuery(
      'INSERT INTO users (id, display_name, avatar_url) VALUES (?, ?, ?)',
      [userId, profile.displayName ?? null, profile.avatarUrl ?? null],
      txOpts
    );

    await runQuery(
      'INSERT INTO user_identities (id, user_id, provider, provider_user_id, email, profile_data) VALUES (?, ?, ?, ?, ?, ?)',
      [
        identityId,
        userId,
        profile.provider,
        profile.providerUserId,
        normalizedEmail ?? profile.email ?? null,
        null,
      ],
      txOpts
    );

    const user = await runQueryOne(
      'SELECT id, display_name, avatar_url, created_at, updated_at FROM users WHERE id = ?',
      [userId],
      txOpts
    );
    return {
      user,
      created: true,
    };
  });
}

module.exports = {
  findById,
  deleteById,
  findIdentityByProvider,
  findIdentitiesByUserId,
  findIdentitiesByEmail,
  linkIdentity,
  createFromPendingProfile,
};
