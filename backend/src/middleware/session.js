const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const config = require('../config');
const csrf = require('csurf');

/**
 * Creates the session middleware backed by the existing MariaDB pool.
 * @param {object} pool - mysql2/promise pool instance
 * @returns {function} Express session + CSRF middleware
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

  // secure and maxAge set; domain omitted by design (same-origin). See AGENTS.md Security.
  const sessionMiddleware = session({
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

  const csrfMiddleware = csrf();

  // Ensure that CSRF checks run after the session has been established.
  return function sessionWithCsrf(req, res, next) {
    sessionMiddleware(req, res, function sessionNext(err) {
      if (err) {
        return next(err);
      }
      csrfMiddleware(req, res, next);
    });
  };
}

module.exports = { createSessionMiddleware };
