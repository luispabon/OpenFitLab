const csrf = require('@dr.pogodin/csurf');

/**
 * CSRF protection middleware (session-based).
 * Validates token on state-changing methods (POST, PATCH, PUT, DELETE).
 * Skips validation when there is no logged-in user (e.g. POST /api/auth/logout with no session).
 * Use req.csrfToken() in routes to obtain a token for the client (e.g. in GET /api/auth/me).
 */
const csrfProtection = csrf({
  ignoreMethods: ['GET', 'HEAD', 'OPTIONS'],
  ignoreRequest(req) {
    return !req.session?.userId;
  },
});

module.exports = { csrfProtection };
