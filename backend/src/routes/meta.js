const express = require('express');
const db = require('../db');
const { parseJSONField } = require('../utils/transforms');

const router = express.Router();

let cachedActivityTypes = null;

/**
 * GET /api/activity-types
 * Returns canonical activity types from sports-lib (cached at startup).
 */
router.get('/activity-types', (req, res) => {
  if (cachedActivityTypes === null) {
    const { ActivityTypesHelper } = require('@sports-alliance/sports-lib');
    cachedActivityTypes = ActivityTypesHelper.getActivityTypesAsUniqueArray();
  }
  res.json(cachedActivityTypes);
});

/**
 * GET /api/devices
 * Returns distinct device names previously recorded in activity_stats.
 */
router.get('/devices', async (req, res, next) => {
  try {
    const rows = await db.query(
      "SELECT value FROM activity_stats WHERE stat_type = 'Device Names'"
    );
    const names = new Set();
    for (const row of rows) {
      const value = parseJSONField(row.value);
      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'string' && item.trim()) names.add(item.trim());
          if (item && typeof item === 'object' && 'name' in item && typeof item.name === 'string') {
            const n = item.name.trim();
            if (n) names.add(n);
          }
        }
      }
    }
    const sorted = Array.from(names).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    res.json(sorted);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
