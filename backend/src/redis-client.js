/**
 * Shared Valkey/Redis client for session store and idempotency keys.
 * Single connection per process.
 */

const { createClient } = require('redis');
const config = require('./config');

let connectPromise;
/** @type {import('redis').RedisClientType | null} */
let sharedClient = null;

/**
 * @returns {Promise<import('redis').RedisClientType>}
 */
async function getRedisClient() {
  if (sharedClient && sharedClient.isOpen) {
    return sharedClient;
  }
  if (!connectPromise) {
    const valkeyConfig = config.valkey;
    const clientOptions = valkeyConfig.url
      ? { url: valkeyConfig.url }
      : { socket: { host: valkeyConfig.host, port: valkeyConfig.port } };
    connectPromise = (async () => {
      const client = createClient(clientOptions);
      client.on('error', (err) => {
        console.error('Valkey/redis client error:', err.message);
      });
      await client.connect();
      sharedClient = client;
      return client;
    })();
  }
  return connectPromise;
}

module.exports = { getRedisClient };
