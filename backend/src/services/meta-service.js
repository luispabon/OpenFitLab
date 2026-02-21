const db = require('../db');

/**
 * Returns distinct activity types from the activities table.
 * @returns {Promise<string[]>}
 */
async function getActivityTypes() {
  const rows = await db.query(
    "SELECT DISTINCT type FROM activities WHERE type IS NOT NULL AND type != '' ORDER BY type"
  );
  return rows.map((r) => r.type.trim()).filter(Boolean);
}

/**
 * Returns distinct device names from the activities table.
 * @returns {Promise<string[]>}
 */
async function getDevices() {
  const rows = await db.query(
    "SELECT DISTINCT device_name FROM activities WHERE device_name IS NOT NULL AND device_name != '' ORDER BY device_name ASC"
  );
  return rows.map((r) => r.device_name);
}

module.exports = { getActivityTypes, getDevices };
