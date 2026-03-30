const { randomUUID } = require('crypto');
const defaultDb = require('../db');
const { extractStreamDataPointsFromJSON } = require('../utils/stream-extractor');
const { extractActivityTimezones } = require('../utils/timezone-extractor');
const { toTimestamp } = require('../utils/transforms');
const eventRepository = require('../repositories/event-repository');
const activityRepository = require('../repositories/activity-repository');
const streamRepository = require('../repositories/stream-repository');

/**
 * Build the event DB row from parsed event data. Pure function, no DB dependency.
 * @param {object} eventJson - Parsed event JSON
 * @param {string} name - Resolved event name
 * @param {number} startDate - Resolved start date timestamp
 * @param {string|null} folderId
 * @param {string|null} extension - File extension (src_file_type)
 * @returns {object} Event row ready for insertEvent (without id, user_id, timezone, import fields)
 */
function buildEventRecord(eventJson, name, startDate, folderId, extension) {
  return {
    start_date: startDate,
    name,
    end_date: toTimestamp(eventJson.endDate, null),
    description: eventJson.description != null ? String(eventJson.description) : null,
    is_merge: eventJson.isMerge === true || eventJson.isMerge === 1 ? 1 : 0,
    src_file_type: extension || null,
    folder_id: folderId,
  };
}

/**
 * Build the activity DB row from parsed activity data. Pure function, no DB dependency.
 * @param {object} activityJson - Parsed activity JSON
 * @param {string} aid - Activity UUID
 * @param {string} eventId - Parent event UUID
 * @returns {object} Activity row ready for insertActivity
 */
function buildActivityRecord(activityJson, aid, eventId) {
  const { startTimezone, endTimezone } = extractActivityTimezones(activityJson);
  return {
    id: aid,
    event_id: eventId,
    name: activityJson.name != null ? String(activityJson.name) : null,
    start_date: toTimestamp(activityJson.startDate, null),
    end_date: toTimestamp(activityJson.endDate, null),
    type: activityJson.type != null ? String(activityJson.type) : 'Other',
    device_name:
      activityJson.creator &&
      typeof activityJson.creator === 'object' &&
      activityJson.creator.name != null
        ? String(activityJson.creator.name).trim() || null
        : null,
    start_timezone: startTimezone,
    end_timezone: endTimezone,
  };
}

/**
 * Persists canonical event + activity payloads in one transaction (same DB shape as after FileParser).
 * `eventJson` / `activityJson` match sports-lib `toJSON()` (stats, streams map/array, timestamps in ms).
 *
 * @param {object} params
 * @param {string} params.userId
 * @param {string|null|undefined} params.folderId
 * @param {object} params.eventJson
 * @param {Array<{ activityJson: object }>} params.activitiesData
 * @param {string|null} [params.srcFileType]
 * @param {string|null} [params.importProvider]
 * @param {string|null} [params.importExternalId]
 * @param {string} [params.eventName] - Resolved display name (e.g. from filename)
 * @param {string|null} [params.eventTimezone] - IANA or offset string for event row; falls back to activity JSON
 * @param {object} [opts]
 * @param {object} [opts.db]
 */
async function persistParsedEvent(params, opts = {}) {
  const {
    userId,
    folderId,
    eventJson,
    activitiesData,
    srcFileType = null,
    importProvider = null,
    importExternalId = null,
    eventName: eventNameParam,
    eventTimezone: eventTimezoneParam,
  } = params;

  if (!userId) throw new Error('persistParsedEvent requires params.userId');
  const db = opts.db ?? defaultDb;

  const startDate = toTimestamp(eventJson.startDate, Date.now());
  const name =
    eventNameParam != null && String(eventNameParam).trim()
      ? String(eventNameParam).trim()
      : eventJson.name != null && String(eventJson.name).trim()
        ? String(eventJson.name).trim()
        : 'Untitled Event';

  const eventStats = eventJson.stats && typeof eventJson.stats === 'object' ? eventJson.stats : {};
  const fid = folderId != null && folderId !== '' ? folderId : null;

  let eventTz = null;
  if (eventTimezoneParam != null && String(eventTimezoneParam).trim()) {
    eventTz = String(eventTimezoneParam).trim();
  }

  const eventId = randomUUID();

  await db.transaction(async (conn) => {
    const tOpts = { ...opts, db, conn, userId };
    const eventRow = buildEventRecord(eventJson, name, startDate, fid, srcFileType);
    await eventRepository.insertEvent(
      {
        id: eventId,
        ...eventRow,
        import_provider: importProvider,
        import_external_id: importExternalId,
        start_timezone: eventTz,
        end_timezone: eventTz,
      },
      tOpts
    );
    await eventRepository.insertEventStats(eventId, eventStats, tOpts);

    const streamRows = [];
    for (const { activityJson } of activitiesData) {
      const aid = randomUUID();
      const streams = activityJson.streams;
      const aStats =
        activityJson.stats && typeof activityJson.stats === 'object' ? activityJson.stats : {};

      const activityRow = buildActivityRecord(activityJson, aid, eventId);
      await activityRepository.insertActivity(activityRow, tOpts);
      await activityRepository.insertActivityStats(aid, aStats, tOpts);

      if (streams) {
        const activityStartDate = toTimestamp(activityJson.startDate, startDate);
        const streamDataPoints = extractStreamDataPointsFromJSON(
          { ...activityJson, streams },
          activityStartDate
        );

        for (const streamInfo of streamDataPoints) {
          if (!streamInfo?.type || !streamInfo.dataPoints?.length) continue;
          if (streamInfo.type === 'Time') continue;

          const streamId = `${aid}_${streamInfo.type}`;
          const data = streamInfo.dataPoints.map((dp) => ({
            time: dp.time,
            value: dp.value,
          }));
          streamRows.push({ id: streamId, activityId: aid, type: streamInfo.type, data });
        }
      }
    }
    if (streamRows.length > 0) {
      await streamRepository.insertStreams(streamRows, tOpts);
    }
  });

  const responseActivities = activitiesData.map(({ activityJson }) => ({
    ...activityJson,
    id: null,
  }));

  return {
    eventId,
    eventJson: { ...eventJson, id: eventId, startDate, name, folderId: fid ?? null },
    activities: responseActivities,
  };
}

module.exports = {
  persistParsedEvent,
  buildEventRecord,
  buildActivityRecord,
};
