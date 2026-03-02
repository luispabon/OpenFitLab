const express = require('express');
const { asyncHandler } = require('../middleware/async-handler');
const { exportUserData, deleteAccount } = require('../services/account-service');
const { validateExportQuery } = require('../utils/validation');
const { NotFoundError } = require('../errors');

const router = express.Router();

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
    res.clearCookie('ofl.sid', { path: '/' });
    res.status(204).send();
  })
);

module.exports = router;
