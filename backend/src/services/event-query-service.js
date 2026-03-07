const defaultDb = require('../db');
const eventRepository = require('../repositories/event-repository');
const activityRepository = require('../repositories/activity-repository');
const { aggregateStats, mapEventRow, mapActivityRow } = require('../utils/transforms');

/**
 * Takes raw event DB rows and returns fully mapped event objects with nested
 * activities and stats.
 */
async function enrichEventsWithStatsAndActivities(eventRows, opts = {}) {
  if (!eventRows || eventRows.length === 0) return [];
  if (!opts.userId) throw new Error('enrichEventsWithStatsAndActivities requires opts.userId');
  const db = opts.db ?? defaultDb;
  const repoOpts = { ...opts, db };

  const eventIds = eventRows.map((r) => r.id);
  const [statsRows, allActivityRows] = await Promise.all([
    eventRepository.getStatsByEventIds(eventIds, repoOpts),
    activityRepository.findManyByEventIds(eventIds, repoOpts),
  ]);

  const statsByEventId = aggregateStats(statsRows, 'event_id');
  const events = eventRows.map((r) => mapEventRow(r, statsByEventId[r.id]));

  if (allActivityRows.length > 0) {
    const activityIds = allActivityRows.map((a) => a.id);
    const activityStatsRows = await activityRepository.getStatsByActivityIds(activityIds, repoOpts);
    const statsByActivityId = aggregateStats(activityStatsRows, 'activity_id');
    const activitiesByEventId = {};
    for (const a of allActivityRows) {
      if (!activitiesByEventId[a.event_id]) activitiesByEventId[a.event_id] = [];
      activitiesByEventId[a.event_id].push(mapActivityRow(a, statsByActivityId[a.id]));
    }
    for (const ev of events) {
      ev.activities = activitiesByEventId[ev.id] || [];
    }
  } else {
    for (const ev of events) {
      ev.activities = [];
    }
  }

  return events;
}

/**
 * Fetches a single event by id with activities and stats.
 * @param {string} eventId - Event UUID
 * @param {{ db?: object }} [opts] - Optional; opts.db for test injection
 * @returns {Promise<{ event: object, activities: Array<object> } | null>}
 */
async function getEventById(eventId, opts = {}) {
  if (!opts.userId) throw new Error('getEventById requires opts.userId');
  const db = opts.db ?? defaultDb;
  const repoOpts = { ...opts, db };
  const event = await eventRepository.findById(eventId, repoOpts);
  if (!event) return null;

  const activities = await activityRepository.findByEventId(eventId, repoOpts);
  const [eventStatsRows, activityStatsRows] = await Promise.all([
    eventRepository.getStatsByEventId(eventId, repoOpts),
    activities.length > 0
      ? activityRepository.getStatsByActivityIds(
          activities.map((a) => a.id),
          repoOpts
        )
      : [],
  ]);

  const eventStats = aggregateStats(eventStatsRows);
  const activityStatsById = aggregateStats(activityStatsRows, 'activity_id');
  const eventJson = mapEventRow(event, eventStats);
  const activitiesJson = activities.map((a) => mapActivityRow(a, activityStatsById[a.id]));

  return { event: eventJson, activities: activitiesJson };
}

/**
 * List events with optional date filter and limit.
 */
async function listEvents(filters = {}, opts = {}) {
  if (!opts.userId) throw new Error('listEvents requires opts.userId');
  const db = opts.db ?? defaultDb;
  const repoOpts = { ...opts, db };
  const rows = await eventRepository.findMany(filters, repoOpts);
  if (rows.length === 0) return [];
  return enrichEventsWithStatsAndActivities(rows, repoOpts);
}

/**
 * Paginated activity rows with filters. Returns { rows: Array<{ event, activity }>, total }.
 */
async function getActivityRows(params = {}, opts = {}) {
  if (!opts.userId) throw new Error('getActivityRows requires opts.userId');
  const db = opts.db ?? defaultDb;
  const repoOpts = { ...opts, db };
  const { pairRows, total } = await activityRepository.getActivityRowPairs(params, repoOpts);
  if (total === 0) return { rows: [], total: 0 };

  const eventIds = [...new Set(pairRows.map((r) => r.event_id))];
  const activityIds = pairRows.map((r) => r.activity_id);

  const [eventRows, activityRows, eventStatsRows, activityStatsRows] = await Promise.all([
    eventRepository.findManyByIds(eventIds, repoOpts),
    activityRepository.findManyByIds(activityIds, repoOpts),
    eventRepository.getStatsByEventIds(eventIds, repoOpts),
    activityRepository.getStatsByActivityIds(activityIds, repoOpts),
  ]);

  const eventsById = Object.fromEntries(eventRows.map((r) => [r.id, r]));
  const activitiesById = Object.fromEntries(activityRows.map((r) => [r.id, r]));
  const statsByEventId = aggregateStats(eventStatsRows, 'event_id');
  const statsByActivityId = aggregateStats(activityStatsRows, 'activity_id');

  const rows = pairRows
    .map(({ event_id, activity_id }) => {
      const eventRow = eventsById[event_id];
      const activityRow = activitiesById[activity_id];
      if (!eventRow || !activityRow) return null;
      return {
        event: mapEventRow(eventRow, statsByEventId[event_id]),
        activity: mapActivityRow(activityRow, statsByActivityId[activity_id]),
      };
    })
    .filter(Boolean);

  return { rows, total };
}

/**
 * Returns events that overlap in time with the given source event (for comparison candidates).
 * When sameFolderOnly is true (default), only returns events in the same folder as the source.
 */
async function getComparisonCandidates(sourceEventId, opts = {}) {
  if (!opts.userId) throw new Error('getComparisonCandidates requires opts.userId');
  const db = opts.db ?? defaultDb;
  const repoOpts = { ...opts, db };
  const sourceEvent = await eventRepository.getDateRange(sourceEventId, repoOpts);
  if (!sourceEvent) return null;

  const sourceStartDate = Number(sourceEvent.start_date);
  const sourceEndDate =
    sourceEvent.end_date != null ? Number(sourceEvent.end_date) : sourceStartDate;
  const sameFolderOnly = opts.sameFolderOnly !== false;
  const overlappingOpts = {
    ...repoOpts,
    sameFolderOnly,
    sourceFolderId: sourceEvent.folder_id ?? null,
  };

  const rows = await eventRepository.findOverlapping(
    sourceEventId,
    sourceStartDate,
    sourceEndDate,
    50,
    overlappingOpts
  );
  if (rows.length === 0) return [];
  return enrichEventsWithStatsAndActivities(rows, repoOpts);
}

module.exports = {
  enrichEventsWithStatsAndActivities,
  getEventById,
  listEvents,
  getActivityRows,
  getComparisonCandidates,
};
