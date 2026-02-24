const express = require('express');
const { getActivityTypes, getDevices } = require('../services/meta-service');
const { asyncHandler } = require('../middleware/async-handler');

const router = express.Router();

/** GET /api/activity-types - distinct activity types from activities table */
router.get(
  '/activity-types',
  asyncHandler(async (req, res) => {
    const types = await getActivityTypes({ userId: req.userId });
    res.json(types);
  })
);

/** GET /api/devices - distinct device names from activities table */
router.get(
  '/devices',
  asyncHandler(async (req, res) => {
    const devices = await getDevices({ userId: req.userId });
    res.json(devices);
  })
);

module.exports = router;
