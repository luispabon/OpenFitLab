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
  const eventEndDate = toTimestamp(eventJson.endDate, null);
  const eventDescription = eventJson.description != null ? String(eventJson.description) : null;
  const eventIsMerge = eventJson.isMerge === true || eventJson.isMerge === 1 ? 1 : 0;
  const srcFileType = extension || null;

  const activities = event.getActivities();
  const eventTimezone = FileParser.extractEventTimezone(event);

  await db.transaction(async (conn) => {
    const tOpts = { ...opts, db, conn };
    await eventRepository.insertEvent(
      {
        id: eventId,
        start_date: startDate,
        name,
        end_date: eventEndDate,
        description: eventDescription,
        is_merge: eventIsMerge,
        src_file_type: srcFileType,
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
      const aName = activityJson.name != null ? String(activityJson.name) : null;
      const aStartDate = toTimestamp(activityJson.startDate, null);
      const aEndDate = toTimestamp(activityJson.endDate, null);
      const aType = activityJson.type != null ? String(activityJson.type) : null;
      const deviceName =
        activityJson.creator &&
        typeof activityJson.creator === 'object' &&
        activityJson.creator.name != null
          ? String(activityJson.creator.name).trim()
          : null;
      const { startTimezone, endTimezone } = extractActivityTimezones(activityJson);

      await activityRepository.insertActivity(
        {
          id: aid,
          event_id: eventId,
          name: aName,
          start_date: aStartDate,
          end_date: aEndDate,
          type: aType,
          device_name: deviceName || null,
          start_timezone: startTimezone,
          end_timezone: endTimezone,
        },
        tOpts
      );
      await activityRepository.insertActivityStats(aid, aStats, tOpts);

      if (streams) {
        const activityStartDate = toTimestamp(activity.startDate, startDate);
        const streamDataPoints = extractStreamDataPointsFromJSON(
          { ...activityJson, streams },
          activityStartDate
        );

        for (const streamInfo of streamDataPoints) {
          if (
            !streamInfo ||
            !streamInfo.type ||
            !streamInfo.dataPoints ||
            streamInfo.dataPoints.length === 0
          ) {
            continue;
          }
          const streamId = `${aid}_${streamInfo.type}`;
          await streamRepository.insertStream(streamId, aid, eventId, streamInfo.type, tOpts);

          const dataPointValues = streamInfo.dataPoints.map((dp, index) => [
            streamId,
            dp.time,
            JSON.stringify(dp.value),
            index,
          ]);
          await streamRepository.insertStreamDataPointsBatch(streamId, dataPointValues, tOpts);
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
    eventJson: { ...eventJson, id: eventId, startDate, name },
    activities: responseActivities,
  };
}

module.exports = { processUpload };
