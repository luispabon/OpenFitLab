const { rateLimit } = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const config = require('../config');

/**
 * In production, `api` runs with multiple replicas (see compose.prod.yaml), so an in-memory
 * store would apply each limit per-replica rather than per-deployment. Limiters share a
 * RedisStore backed by the Valkey client instead.
 *
 * The shared client connects asynchronously at startup (see index.js `start()`), so this
 * module must not connect itself. `sendCommand` waits on a deferred promise resolved by
 * `attachRateLimitClient()` once the client is ready — by the time the server starts
 * accepting requests, the promise has already resolved.
 *
 * Rate limiting fails open: `passOnStoreError: true` means a Valkey outage lets requests
 * through rather than blocking the API, which is an acceptable tradeoff for rate limiting.
 */
let resolveClient;
const clientPromise = new Promise((resolve) => {
  resolveClient = resolve;
});

function attachRateLimitClient(client) {
  resolveClient(client);
}

/**
 * Builds a RedisStore for the given key prefix in production, or `undefined` outside
 * production (or in tests) so express-rate-limit falls back to its in-memory store.
 */
function createStore(prefix, isProduction = config.server.isProduction) {
  if (!isProduction) return undefined;
  return new RedisStore({
    prefix,
    sendCommand: (...args) => clientPromise.then((client) => client.sendCommand(args)),
  });
}

function buildLimiter({ rateLimitConfig, prefix, message }) {
  return rateLimit({
    windowMs: rateLimitConfig.windowMs,
    max: rateLimitConfig.max,
    standardHeaders: true,
    legacyHeaders: false,
    store: createStore(prefix),
    passOnStoreError: true,
    ...(message ? { message } : {}),
  });
}

/**
 * Global API rate limiter
 */
const apiLimiter = buildLimiter({
  rateLimitConfig: config.rateLimit.api,
  prefix: 'rl:api:',
  message: { error: 'Too many requests, please try again later.' },
});

/**
 * Auth rate limiter (login initiation)
 */
const authLimiter = buildLimiter({
  rateLimitConfig: config.rateLimit.auth,
  prefix: 'rl:auth:',
  message: { error: 'Too many login attempts, please try again after 15 minutes.' },
});

/**
 * OAuth callback rate limiter (slightly higher because automated)
 */
const callbackLimiter = buildLimiter({
  rateLimitConfig: config.rateLimit.authCallback,
  prefix: 'rl:auth-callback:',
});

/**
 * Upload rate limiter
 */
const uploadLimiter = buildLimiter({
  rateLimitConfig: config.rateLimit.upload,
  prefix: 'rl:upload:',
  message: { error: 'Upload limit reached, please try again later.' },
});

/** Strava list/import — same caps as upload (per-user burst to Strava upstream). */
const integrationLimiter = buildLimiter({
  rateLimitConfig: config.rateLimit.upload,
  prefix: 'rl:integration:',
  message: { error: 'Too many import requests, please try again later.' },
});

module.exports = {
  apiLimiter,
  authLimiter,
  callbackLimiter,
  uploadLimiter,
  integrationLimiter,
  attachRateLimitClient,
  createStore,
};
