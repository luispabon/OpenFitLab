const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const config = require('../config');

/**
 * Creates the session middleware backed by the existing MariaDB pool.
 * @param {object} pool - mysql2/promise pool instance
 * @returns {function} Express session middleware
 */
function createSessionMiddleware(pool) {
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
