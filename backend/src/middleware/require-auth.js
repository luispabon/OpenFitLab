/**
 * Authentication guard middleware.
 * Returns 401 if no valid session exists; otherwise attaches req.userId for downstream use.
 */
function requireAuth(req, res, next) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  req.userId = req.session.userId;
  next();
}

module.exports = { requireAuth };
