const { randomUUID } = require('node:crypto');
const { runQuery } = require('./query-helper');
const { normalizeEmail } = require('../utils/email');

async function findById(id, opts = {}) {
  const rows = await runQuery(
    'SELECT id, display_name, avatar_url, created_at, updated_at FROM users WHERE id = ?',
    [id],
    opts
  );
  return Array.isArray(rows) ? (rows[0] ?? null) : null;
}

async function findOrCreateByIdentity(provider, providerUserId, profile, opts = {}) {
  const db = opts.db ?? require('../db');

  return db.transaction(async (conn) => {
    const txOpts = { ...opts, db, conn };

    const existing = await runQuery(
      'SELECT user_id FROM user_identities WHERE provider = ? AND provider_user_id = ?',
      [provider, providerUserId],
      txOpts
    );
    const existingRow = Array.isArray(existing) ? (existing[0] ?? null) : null;

    if (existingRow) {
      const userId = existingRow.user_id;
      await runQuery(
        'UPDATE users SET display_name = COALESCE(?, display_name), avatar_url = COALESCE(?, avatar_url) WHERE id = ?',
        [profile.displayName ?? null, profile.avatarUrl ?? null, userId],
        txOpts
      );
      const user = await runQuery(
        'SELECT id, display_name, avatar_url, created_at, updated_at FROM users WHERE id = ?',
        [userId],
        txOpts
      );
      return { user: Array.isArray(user) ? user[0] : user, created: false };
    }

    const normalizedEmail = normalizeEmail(profile.email);
    const emailVerified = profile.emailVerified === true;

    if (normalizedEmail && emailVerified) {
      const byEmail = await runQuery(
        'SELECT DISTINCT user_id FROM user_identities WHERE LOWER(TRIM(email)) = ? AND email IS NOT NULL',
        [normalizedEmail],
        txOpts
      );
      const rows = Array.isArray(byEmail) ? byEmail : [];
      if (rows.length === 1) {
        const userId = rows[0].user_id;
        const identityId = randomUUID();
        await runQuery(
          'UPDATE users SET display_name = COALESCE(?, display_name), avatar_url = COALESCE(?, avatar_url) WHERE id = ?',
          [profile.displayName ?? null, profile.avatarUrl ?? null, userId],
          txOpts
        );
        await runQuery(
          'INSERT INTO user_identities (id, user_id, provider, provider_user_id, email, profile_data) VALUES (?, ?, ?, ?, ?, ?)',
          [
            identityId,
            userId,
            provider,
            providerUserId,
            normalizedEmail,
            profile.profileData ? JSON.stringify(profile.profileData) : null,
          ],
          txOpts
        );
        const user = await runQuery(
          'SELECT id, display_name, avatar_url, created_at, updated_at FROM users WHERE id = ?',
          [userId],
          txOpts
        );
        return { user: Array.isArray(user) ? user[0] : user, created: false };
      }
    }

    const userId = randomUUID();
    const identityId = randomUUID();
    const identityEmail = normalizedEmail ?? profile.email ?? null;

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
        provider,
        providerUserId,
        identityEmail,
        profile.profileData ? JSON.stringify(profile.profileData) : null,
      ],
      txOpts
    );

    const user = await runQuery(
      'SELECT id, display_name, avatar_url, created_at, updated_at FROM users WHERE id = ?',
      [userId],
      txOpts
    );
    return { user: Array.isArray(user) ? user[0] : user, created: true };
  });
}

async function deleteById(id, opts = {}) {
  const result = await runQuery('DELETE FROM users WHERE id = ?', [id], opts);
  return result && result.affectedRows === 1;
}

module.exports = {
  findById,
  findOrCreateByIdentity,
  deleteById,
};
