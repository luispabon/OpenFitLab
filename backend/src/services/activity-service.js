const defaultDb = require('../db');
const eventRepository = require('../repositories/event-repository');
const activityRepository = require('../repositories/activity-repository');
const { aggregateStats, mapActivityRow } = require('../utils/transforms');

/**
 * Updates an activity's type and/or device_name. When type is updated, recomputes
 * the event's "Activity Types" stat.
 */
async function updateActivity(eventId, activityId, updates, opts = {}) {
  const db = opts.db ?? defaultDb;
  const repoOpts = { ...opts, db };
  const activity = await activityRepository.findByIdAndEventId(activityId, eventId, repoOpts);
  if (!activity) return null;

  const { type: typeUpdate, deviceName } = updates;

  await db.transaction(async (conn) => {
    const tOpts = { ...opts, db, conn };
    if (typeUpdate !== undefined && typeUpdate !== null) {
      const typeValue = String(typeUpdate).trim() || null;
      await activityRepository.updateType(activityId, eventId, typeValue, tOpts);
      const types = await activityRepository.getTypesByEventId(eventId, tOpts);
      await eventRepository.upsertEventStat(eventId, 'Activity Types', types, tOpts);
    }
    if (deviceName !== undefined && deviceName !== null) {
      const deviceValue = String(deviceName).trim() || null;
      await activityRepository.updateDeviceName(activityId, eventId, deviceValue, tOpts);
    }
  });

  const updatedRow = await activityRepository.findByIdAndEventId(activityId, eventId, repoOpts);
  const statsRows = await activityRepository.getStatsByActivityId(activityId, repoOpts);
  const activityStats = aggregateStats(statsRows);
  return mapActivityRow(updatedRow, activityStats);
}

module.exports = { updateActivity };
