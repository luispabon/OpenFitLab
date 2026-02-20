const express = require('express');
const db = require('../db');
const { parseJSONField } = require('../utils/transforms');

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
 * Returns distinct device names previously recorded in activity_stats.
 */
router.get('/devices', async (req, res, next) => {
  try {
    const rows = await db.query(
      "SELECT DISTINCT value FROM activity_stats WHERE stat_type = 'Device Names' ORDER BY value ASC"
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
