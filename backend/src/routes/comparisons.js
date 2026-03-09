const express = require('express');
const {
  createComparison,
  getComparisons,
  getComparisonById,
  getComparisonsByEventIds,
  deleteComparisonById,
  updateComparisonFolder,
  updateComparisonSettings,
} = require('../services/comparison-service');
const {
  validateComparisonId,
  validateComparisonBody,
  validateComparisonByEventsBody,
  validateComparisonFolderUpdateBody,
  validateComparisonSettingsBody,
} = require('../utils/validation');
const { asyncHandler } = require('../middleware/async-handler');
const { NotFoundError } = require('../errors');

const router = express.Router();

// POST /api/comparisons
router.post(
  '/',
  validateComparisonBody,
  asyncHandler(async (req, res) => {
    const { name, activityIds, settings, folderId } = req.body;
    const comparison = await createComparison(name, activityIds, settings, {
      userId: req.userId,
      folderId: folderId ?? null,
    });
    res.status(201).json(comparison);
  })
);

// GET /api/comparisons?folderId=
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const folderId = req.query.folderId;
    const comparisons = await getComparisons(100, {
      userId: req.userId,
      folderId: folderId === 'unfiled' || folderId === '' ? 'unfiled' : folderId,
    });
    res.json(comparisons);
  })
);

// POST /api/comparisons/by-events
router.post(
  '/by-events',
  validateComparisonByEventsBody,
  asyncHandler(async (req, res) => {
    const { eventIds } = req.body;
    const comparisons = await getComparisonsByEventIds(eventIds, { userId: req.userId });
    res.json(comparisons);
  })
);

// GET /api/comparisons/:id
router.get(
  '/:id',
  validateComparisonId,
  asyncHandler(async (req, res) => {
    const comparison = await getComparisonById(req.params.id, { userId: req.userId });
    if (!comparison) throw new NotFoundError('Comparison not found');
    res.json(comparison);
  })
);

// PATCH /api/comparisons/:id/folder
router.patch(
  '/:id/folder',
  validateComparisonId,
  validateComparisonFolderUpdateBody,
  asyncHandler(async (req, res) => {
    const { folderId } = req.body;
    const updated = await updateComparisonFolder(req.params.id, folderId ?? null, {
      userId: req.userId,
    });
    if (!updated) throw new NotFoundError('Comparison not found');
    res.status(204).send();
  })
);

// PATCH /api/comparisons/:id/settings
router.patch(
  '/:id/settings',
  validateComparisonId,
  validateComparisonSettingsBody,
  asyncHandler(async (req, res) => {
    const { settings } = req.body;
    const updated = await updateComparisonSettings(req.params.id, settings, { userId: req.userId });
    if (!updated) throw new NotFoundError('Comparison not found');
    res.json({ settings: updated });
  })
);

// DELETE /api/comparisons/:id
router.delete(
  '/:id',
  validateComparisonId,
  asyncHandler(async (req, res) => {
    const deleted = await deleteComparisonById(req.params.id, { userId: req.userId });
    if (!deleted) throw new NotFoundError('Comparison not found');
    res.status(204).send();
  })
);

module.exports = router;
