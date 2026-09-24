const express = require('express');
const { asyncHandler } = require('../middleware/async-handler');
const { exportUserData, deleteAccount } = require('../services/account-service');
const { destroySession } = require('../services/auth-service');
const { revokeUserSessions } = require('../session-registry');
const { validateExportQuery } = require('../utils/validation');
const { NotFoundError } = require('../errors');

const router = express.Router();

/**
 * Run one best-effort cleanup step, collecting (instead of throwing) its error so the
 * remaining steps still run after a partial failure.
 * @param {() => Promise<void>} step
 * @param {Array<Error>} errors
 */
async function attemptCleanup(step, errors) {
  try {
    await step();
  } catch (err) {
    errors.push(err);
  }
}

// GET /api/account/export?includeStreams=true
router.get(
  '/export',
  validateExportQuery,
  asyncHandler(async (req, res) => {
    const includeStreams = req.query.includeStreams === 'true';
    const data = await exportUserData(req.userId, { includeStreams });
    if (!data) throw new NotFoundError('User not found');
    res.json(data);
  })
);

// DELETE /api/account
router.delete(
  '/',
  asyncHandler(async (req, res) => {
    const deleted = await deleteAccount(req.userId);
    if (!deleted) throw new NotFoundError('User not found');
    // The user row is already gone, so cleanup failures must not fail the request. Both steps
    // are attempted; any session that survives (untracked, or a step that failed) is rejected
    // by requireAuth's user-existence check on its next request.
    const cleanupErrors = [];
    await attemptCleanup(() => destroySession(req), cleanupErrors);
    await attemptCleanup(() => revokeUserSessions(req.userId), cleanupErrors);
    if (cleanupErrors.length > 0) {
      console.error('Account deletion session cleanup failed:', cleanupErrors);
    }
    res.clearCookie('ofl.sid', { path: '/' });
    res.status(204).send();
  })
);

module.exports = router;
