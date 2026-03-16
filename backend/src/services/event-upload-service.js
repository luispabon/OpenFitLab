const { randomUUID } = require('crypto');
const defaultDb = require('../db');
const FileParser = require('../parsers/file-parser');
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
 * @returns {object} Event row ready for insertEvent (without id, user_id, timezone fields)
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
 * Parses an uploaded file and persists event, activities, stats, and streams to the DB.
 */
async function processUpload(fileBuffer, extension, originalFilename, opts = {}) {
  if (!opts.userId) throw new Error('processUpload requires opts.userId');
  const db = opts.db ?? defaultDb;
  const event = await FileParser.parseFile(fileBuffer, extension, originalFilename);

  const eventId = randomUUID();
  const startDate = toTimestamp(event.startDate, Date.now());
  const name =
    originalFilename && originalFilename.trim()
      ? originalFilename.replace(/\.[^/.]+$/, '').trim()
      : event.name && event.name.trim()
        ? event.name.trim()
        : 'Untitled Event';

  const eventJson = event.toJSON();
  const eventStats = eventJson.stats && typeof eventJson.stats === 'object' ? eventJson.stats : {};
  const folderId = opts.folderId != null && opts.folderId !== '' ? opts.folderId : null;
  const eventTimezone = FileParser.extractEventTimezone(event);

  const activities = event.getActivities();

  await db.transaction(async (conn) => {
    const tOpts = { ...opts, db, conn };
    const eventRow = buildEventRecord(eventJson, name, startDate, folderId, extension);
    await eventRepository.insertEvent(
      {
        id: eventId,
        ...eventRow,
        start_timezone: eventTimezone,
        end_timezone: eventTimezone,
      },
      tOpts
    );
    await eventRepository.insertEventStats(eventId, eventStats, tOpts);

    for (const activity of activities) {
      const aid = randomUUID();
      const activityJson = activity.toJSON();
      const streams = activityJson.streams;
      const aStats =
        activityJson.stats && typeof activityJson.stats === 'object' ? activityJson.stats : {};

      const activityRow = buildActivityRecord(activityJson, aid, eventId);
      await activityRepository.insertActivity(activityRow, tOpts);
      await activityRepository.insertActivityStats(aid, aStats, tOpts);

      if (streams) {
        const activityStartDate = toTimestamp(activity.startDate, startDate);
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
          await streamRepository.insertStream(streamId, aid, streamInfo.type, data, tOpts);
        }
      }
    }
  });

  const responseActivities = activities.map((activity) => {
    const activityJson = activity.toJSON();
    return { ...activityJson, id: null };
  });

  return {
    eventId,
    eventJson: { ...eventJson, id: eventId, startDate, name, folderId: folderId ?? null },
    activities: responseActivities,
  };
}

/**
 * Processes a batch of uploaded files and returns per-file results.
 * @param {Array<{ buffer: Buffer, originalname?: string }>} files
 * @param {string} userId
 * @param {Function} processUploadFn - (buffer, extension, filename, opts) => Promise
 * @param {{ folderId?: string | null }} [options]
 * @returns {Promise<Array<{ success: boolean, filename: string, id?: string, event?: object, activities?: array, error?: string }>>}
 */
async function buildUploadResults(files, userId, processUploadFn, options = {}) {
  const results = [];
  const folderId = options.folderId != null && options.folderId !== '' ? options.folderId : null;
  for (const file of files) {
    const filename = file.originalname || 'file';
    const extension = FileParser.getExtension(filename);
    if (!extension) {
      results.push({ success: false, filename, error: 'Unsupported file type' });
      continue;
    }
    try {
      const { eventId, eventJson, activities } = await processUploadFn(
        file.buffer,
        extension,
        filename,
        { userId, folderId: folderId || undefined }
      );
      results.push({
        success: true,
        filename,
        id: eventId,
        event: eventJson,
        activities,
      });
    } catch (err) {
      results.push({
        success: false,
        filename,
        error: err.message || 'Failed to parse file',
      });
    }
  }
  return results;
}

module.exports = { processUpload, buildEventRecord, buildActivityRecord, buildUploadResults };
