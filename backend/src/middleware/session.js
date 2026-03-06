const session = require('express-session');
const RedisStore = require('connect-redis').default;
const { createClient } = require('redis');
const config = require('../config');

/**
 * Creates the session middleware backed by Valkey (Redis-protocol compatible).
 * Connects to Valkey using config.valkey (url or host/port).
 * @returns {Promise<function>} Promise that resolves to Express session middleware
 */
async function createSessionMiddleware() {
  const { valkey: valkeyConfig } = config;
  const clientOptions = valkeyConfig.url
    ? { url: valkeyConfig.url }
    : { socket: { host: valkeyConfig.host, port: valkeyConfig.port } };

  const client = createClient(clientOptions);
  await client.connect();

  const store = new RedisStore({
    client,
    prefix: 'ofl:sess:',
  });

  // secure and maxAge set; domain omitted by design (same-origin). See AGENTS.md Security.
  return session({
    secret: config.session.secret,
    store,
    resave: false,
    saveUninitialized: false,
    name: 'ofl.sid',
    cookie: {
      httpOnly: true,
      secure: config.session.cookieSecure,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
    },
  });
}

module.exports = { createSessionMiddleware };
