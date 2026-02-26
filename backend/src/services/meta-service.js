const defaultDb = require('../db');
const activityRepository = require('../repositories/activity-repository');

/**
 * Returns distinct activity types from the activities table.
 */
async function getActivityTypes(opts = {}) {
  if (!opts.userId) throw new Error('getActivityTypes requires opts.userId');
  const db = opts.db ?? defaultDb;
  const repoOpts = { ...opts, db };
  return activityRepository.getDistinctTypes(repoOpts);
}

/**
 * Returns distinct device names from the activities table.
 */
async function getDevices(opts = {}) {
  if (!opts.userId) throw new Error('getDevices requires opts.userId');
  const db = opts.db ?? defaultDb;
  const repoOpts = { ...opts, db };
  return activityRepository.getDistinctDeviceNames(repoOpts);
}

module.exports = { getActivityTypes, getDevices };
