#!/usr/bin/env node
/**
 * DAST seed script — creates a disposable test user in MariaDB and injects a
 * pre-signed session into Valkey so ZAP can scan authenticated endpoints.
 *
 * Run inside the api container (has all node_modules + network access to db/valkey):
 *   docker compose exec -T api node scripts/dast-seed.mjs
 *
 * Outputs a single line:  SESSION_COOKIE=<signed-cookie-value>
 *
 * The caller is responsible for fetching the CSRF token separately:
 *   curl -sf -H "Cookie: ofl.sid=<value>" http://localhost:3000/api/auth/me
 */

import crypto from 'node:crypto';
import { createConnection } from 'mysql2/promise';
import { createClient } from 'redis';
import { sign } from 'cookie-signature';

const {
  DB_HOST = 'db',
  DB_USER = 'qs',
  DB_PASSWORD = 'qspass',
  DB_DATABASE = 'openfitlab',
  VALKEY_HOST = 'valkey',
  VALKEY_PORT = '6379',
  SESSION_SECRET,
} = process.env;

if (!SESSION_SECRET || SESSION_SECRET.length < 32) {
  console.error('SESSION_SECRET must be set and at least 32 characters');
  process.exit(1);
}

// Create test user
const db = await createConnection({
  host: DB_HOST,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_DATABASE,
});

const userId = crypto.randomUUID();
await db.execute('INSERT INTO users (id, display_name) VALUES (?, ?)', [
  userId,
  'ZAP DAST Test User',
]);
await db.end();

// Build session and inject into Valkey
const sessionId = crypto.randomBytes(32).toString('base64url');
const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);

const sessionData = JSON.stringify({
  cookie: {
    originalMaxAge: 7 * 24 * 3600 * 1000,
    expires: expiresAt.toISOString(),
    secure: false,
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
  },
  userId,
});

const valkey = createClient({
  socket: { host: VALKEY_HOST, port: parseInt(VALKEY_PORT, 10) },
});
await valkey.connect();
await valkey.set(`ofl:sess:${sessionId}`, sessionData, { EX: 7 * 24 * 3600 });
await valkey.disconnect();

// express-session signed cookie format: s:<sessionId>.<hmac-sha256-base64>
const signedCookie = `s:${sign(sessionId, SESSION_SECRET)}`;

// Emit in a format easy to parse from shell: SESSION_COOKIE=<value>
console.log(`SESSION_COOKIE=${signedCookie}`);
