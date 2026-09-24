/**
 * Authentication guard middleware.
 * Returns 401 if no valid session exists, or if the session's user no longer exists
 * (e.g. the account was deleted while the session survived revocation); otherwise
 * attaches req.userId for downstream use. DB errors fail closed via the error handler.
 */

const { asyncHandler } = require('./async-handler');
const userRepository = require('../repositories/user-repository');

/**
 * Destroy the current session, ignoring store errors: the request is rejected either way.
 * @param {import('express').Request} req
 * @returns {Promise<void>}
 */
function destroySessionQuietly(req) {
  return new Promise((resolve) => {
    try {
      if (typeof req.session?.destroy !== 'function') {
        resolve();
        return;
      }
      req.session.destroy(() => resolve());
    } catch {
      // Synchronous store error: the request is rejected either way.
      resolve();
    }
  });
}

const requireAuth = asyncHandler(async (req, res, next) => {
  const userId = req.session?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const user = await userRepository.findById(userId);
  if (!user) {
    // Stale session for a deleted user: drop it and clear the cookie. No third-party calls.
    await destroySessionQuietly(req);
    res.clearCookie('ofl.sid', { path: '/' });
    return res.status(401).json({ error: 'Authentication required' });
  }
  req.userId = userId;
  next();
});

module.exports = { requireAuth };
