const express = require('express');
const { getActivityTypes, getDevices } = require('../services/meta-service');

const router = express.Router();

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** GET /api/activity-types - distinct activity types from activities table */
router.get(
  '/activity-types',
  asyncHandler(async (req, res) => {
    const types = await getActivityTypes();
    res.json(types);
  })
);

/** GET /api/devices - distinct device names from activities table */
router.get(
  '/devices',
  asyncHandler(async (req, res) => {
    const devices = await getDevices();
    res.json(devices);
  })
);

module.exports = router;
