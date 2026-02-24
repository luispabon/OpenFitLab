const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);

/**
 * Creates the session middleware backed by the existing MariaDB pool.
 * @param {object} pool - mysql2/promise pool instance
 * @returns {function} Express session middleware
 */
function createSessionMiddleware(pool) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('SESSION_SECRET must be set and at least 32 characters');
  }

  const store = new MySQLStore(
    {
      createDatabaseTable: false,
      schema: {
        tableName: 'sessions',
        columnNames: {
          session_id: 'session_id',
          expires: 'expires',
          data: 'data',
        },
      },
    },
    pool
  );

  return session({
    secret,
    store,
    resave: false,
    saveUninitialized: false,
    name: 'ofl.sid',
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
    },
  });
}

module.exports = { createSessionMiddleware };
