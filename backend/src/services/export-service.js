'use strict';

const defaultDb = require('../db');
const eventRepository = require('../repositories/event-repository');
const activityRepository = require('../repositories/activity-repository');
const streamRepository = require('../repositories/stream-repository');
const { buildTcx, sanitizeFilename } = require('../utils/tcx-builder');
const { buildGpx } = require('../utils/gpx-builder');
const { parseJSONField, aggregateStats } = require('../utils/transforms');

/**
 * Groups stream rows by activity id and parses the JSON data field.
 * @param {object[]} streamRows
 * @param {string[]} activityIds
 * @returns {Record<string, Record<string, Array<{time: number, value: any}>>>}
 */
function groupAndParseStreams(streamRows, activityIds) {
  const result = {};
  for (const id of activityIds) {
    result[id] = {};
  }
  for (const row of streamRows) {
    const data = parseJSONField(row.data, []);
    if (!result[row.activity_id]) result[row.activity_id] = {};
    result[row.activity_id][row.type] = data;
  }
  return result;
}

/**
 * Exports an event as a TCX XML document.
 * @param {string} eventId
 * @param {object} opts - must include opts.userId
 * @returns {Promise<{xml: string, name: string}|null>} null if event not found
 */
async function exportEventAsTcx(eventId, opts = {}) {
  const db = opts.db ?? defaultDb;
  const repoOpts = { ...opts, db };

  const event = await eventRepository.findById(eventId, repoOpts);
  if (!event) return null;

  const activities = await activityRepository.findByEventId(eventId, repoOpts);
  const activityIds = activities.map((a) => a.id);

  const [activityStatRows, streamRows] = await Promise.all([
    activityIds.length
      ? activityRepository.getStatsByActivityIds(activityIds, repoOpts)
      : Promise.resolve([]),
    activityIds.length
      ? streamRepository.findAllByActivityIds(activityIds, repoOpts)
      : Promise.resolve([]),
  ]);

  const statsByActivityId = aggregateStats(activityStatRows, 'activity_id');
  const streamsByActivityId = groupAndParseStreams(streamRows, activityIds);

  const xml = buildTcx(event, activities, statsByActivityId, streamsByActivityId);
  const name = sanitizeFilename(event.name, `event-${eventId}`);

  return { xml, name };
}

/**
 * Exports an event as a GPX XML document.
 * Returns null if the event is not found or has no GPS streams.
 * @param {string} eventId
 * @param {object} opts - must include opts.userId
 * @returns {Promise<{xml: string, name: string}|null>}
 */
async function exportEventAsGpx(eventId, opts = {}) {
  const db = opts.db ?? defaultDb;
  const repoOpts = { ...opts, db };

  const event = await eventRepository.findById(eventId, repoOpts);
  if (!event) return null;

  const activities = await activityRepository.findByEventId(eventId, repoOpts);
  const activityIds = activities.map((a) => a.id);

  const streamRows = activityIds.length
    ? await streamRepository.findAllByActivityIds(activityIds, repoOpts)
    : [];

  const streamsByActivityId = groupAndParseStreams(streamRows, activityIds);

  const xml = buildGpx(event, activities, streamsByActivityId);
  if (!xml) return null;

  const name = sanitizeFilename(event.name, `event-${eventId}`);
  return { xml, name };
}

module.exports = { exportEventAsTcx, exportEventAsGpx };
