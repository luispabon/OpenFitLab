const csrf = require('@dr.pogodin/csurf').default;

/**
 * CSRF protection middleware (session-based).
 * Validates token on state-changing methods (POST, PATCH, PUT, DELETE).
 * Skips validation when there is no logged-in user (e.g. POST /api/auth/logout with no session).
 * Use req.csrfToken() in routes to obtain a token for the client (e.g. in GET /api/auth/me).
 */
const csrfMiddleware = csrf({
  ignoreMethods: ['GET', 'HEAD', 'OPTIONS'],
  ignoreRequest(req) {
    return !req.session?.userId;
  },
});

/**
 * Bypasses CSRF entirely for requests with no session user data, i.e. neither a
 * logged-in user (userId) nor a pending signup. Such requests never issue or validate
 * a token, but running csurf would generate and store a session secret, causing
 * express-session to persist a server-side session for every anonymous request.
 * Sessions with a userId or pending signup still run csurf so tokens are validated
 * and req.csrfToken() remains available to the routes that mint them.
 */
function csrfProtection(req, res, next) {
  if (!req.session?.userId && !req.session?.pendingSignup) {
    return next();
  }
  return csrfMiddleware(req, res, next);
}

module.exports = { csrfProtection };
