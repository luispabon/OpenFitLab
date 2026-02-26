const express = require('express');
const {
  createComparison,
  getComparisons,
  getComparisonById,
  getComparisonsByEventIds,
  deleteComparisonById,
} = require('../services/comparison-service');
const {
  validateComparisonId,
  validateComparisonBody,
  validateComparisonByEventsBody,
} = require('../utils/validation');
const { asyncHandler } = require('../middleware/async-handler');

const router = express.Router();

// POST /api/comparisons
router.post(
  '/',
  validateComparisonBody,
  asyncHandler(async (req, res) => {
    const { name, eventIds, settings } = req.body;
    const comparison = await createComparison(name, eventIds, settings, { userId: req.userId });
    res.status(201).json(comparison);
  })
);

// GET /api/comparisons
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const comparisons = await getComparisons(100, { userId: req.userId });
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
    if (!comparison) return res.status(404).json({ error: 'Comparison not found' });
    res.json(comparison);
  })
);

// DELETE /api/comparisons/:id
router.delete(
  '/:id',
  validateComparisonId,
  asyncHandler(async (req, res) => {
    const deleted = await deleteComparisonById(req.params.id, { userId: req.userId });
    if (!deleted) return res.status(404).json({ error: 'Comparison not found' });
    res.status(204).send();
  })
);

module.exports = router;
