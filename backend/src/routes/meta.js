const express = require('express');
const db = require('../db');

const router = express.Router();

/**
 * GET /api/activity-types
 * Returns distinct activity types present in the activities table.
 */
router.get('/activity-types', async (req, res, next) => {
  try {
    const rows = await db.query(
      "SELECT DISTINCT type FROM activities WHERE type IS NOT NULL AND type != '' ORDER BY type"
    );
    const types = rows.map((r) => r.type.trim()).filter(Boolean);
    res.json(types);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/devices
 * Returns distinct device names from the activities table.
 */
router.get('/devices', async (req, res, next) => {
  try {
    const rows = await db.query(
      "SELECT DISTINCT device_name FROM activities WHERE device_name IS NOT NULL AND device_name != '' ORDER BY device_name ASC"
    );
    res.json(rows.map((r) => r.device_name));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
