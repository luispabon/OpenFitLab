const defaultDb = require('../db');
const eventRepository = require('../repositories/event-repository');
const folderRepository = require('../repositories/folder-repository');
const {
  listActivities,
  fetchActivityBundle,
  normalizeStravaToCanonical,
} = require('../integrations/strava-driver');
const { persistParsedEvent } = require('./event-upload-service');
const { NotFoundError, StravaTokenExpiredError } = require('../errors');

const PROVIDER = 'strava';

/**
 * @param {import('express-session').Session & Record<string, unknown>} session
 */
function stravaConnectionStatus(session) {
  const s = session?.integrations?.strava;
  if (!s?.accessToken) {
    return { connected: false, expiresAt: null };
  }
  const expiresAt = typeof s.expiresAt === 'number' ? s.expiresAt : null;
  if (expiresAt != null && Date.now() >= expiresAt) {
    return { connected: false, expiresAt };
  }
  return { connected: true, expiresAt };
}

/**
 * @param {import('express-session').Session & Record<string, unknown>} session
 * @returns {string} access token
 */
function requireStravaAccessToken(session) {
  const st = stravaConnectionStatus(session);
  if (!st.connected) {
    throw new StravaTokenExpiredError();
  }
  return String(session.integrations.strava.accessToken);
}

/**
 * @param {{ page?: number, perPage?: number }} params
 */
async function listStravaActivitiesForUser(session, params = {}, opts = {}) {
  if (!opts.userId) throw new Error('listStravaActivitiesForUser requires opts.userId');
  const token = requireStravaAccessToken(session);
  const db = opts.db ?? defaultDb;
  const repoOpts = { ...opts, db };
  const page = params.page ?? 1;
  const perPage = params.perPage ?? 30;
  const raw = await listActivities(token, { page, perPage });
  const list = Array.isArray(raw) ? raw : [];
  const ids = list.map((a) => String(a.id));
  const imported = await eventRepository.findImportKeyMap(PROVIDER, ids, repoOpts);
  return list.map((a) => {
    const id = String(a.id);
    return {
      id,
      name: a.name != null ? String(a.name) : '',
      startDate: new Date(a.start_date).getTime(),
      type: a.type != null ? String(a.type) : null,
      sportType: a.sport_type != null ? String(a.sport_type) : null,
      distance: a.distance != null ? Number(a.distance) : null,
      movingTime: a.moving_time != null ? Number(a.moving_time) : null,
      alreadyImported: imported.has(id),
      eventId: imported.get(id) ?? null,
    };
  });
}

function isDuplicateImportError(err) {
  return err && (err.code === 'ER_DUP_ENTRY' || err.errno === 1062);
}

/**
 * @param {string[]} externalIds
 * @param {string|null|undefined} folderId
 * @param {import('express-session').Session & Record<string, unknown>} session
 */
async function importStravaActivitiesByExternalIds(externalIds, folderId, session, opts = {}) {
  if (!opts.userId) throw new Error('importStravaActivitiesByExternalIds requires opts.userId');
  const token = requireStravaAccessToken(session);
  const db = opts.db ?? defaultDb;
  const repoOpts = { ...opts, db };
  const userId = opts.userId;

  let fid = null;
  if (folderId != null && folderId !== '') {
    const folder = await folderRepository.findById(folderId, repoOpts);
    if (!folder) throw new NotFoundError('Folder not found');
    fid = folderId;
  }

  const existing = await eventRepository.findImportKeyMap(PROVIDER, externalIds, repoOpts);
  /** @type {Array<{ externalId: string, success: boolean, eventId?: string, error?: string }>} */
  const results = [];
  const seenInRequest = new Set();

  for (const extId of externalIds) {
    const id = String(extId);
    if (seenInRequest.has(id)) {
      results.push({ externalId: id, success: false, error: 'Duplicate in request' });
      continue;
    }
    seenInRequest.add(id);
    if (existing.has(id)) {
      results.push({
        externalId: id,
        success: false,
        error: 'Already imported',
        eventId: existing.get(id),
      });
      continue;
    }
    try {
      const { detail, streams } = await fetchActivityBundle(token, id, opts);
      const { eventJson, activitiesData } = normalizeStravaToCanonical(detail, streams);
      const name =
        eventJson.name != null && String(eventJson.name).trim()
          ? String(eventJson.name).trim()
          : 'Activity';
      const { eventId } = await persistParsedEvent(
        {
          userId,
          folderId: fid,
          eventJson,
          activitiesData,
          srcFileType: null,
          importProvider: PROVIDER,
          importExternalId: id,
          eventName: name,
          eventTimezone: null,
        },
        repoOpts
      );
      results.push({ externalId: id, success: true, eventId });
    } catch (err) {
      if (isDuplicateImportError(err)) {
        results.push({ externalId: id, success: false, error: 'Already imported' });
      } else {
        throw err;
      }
    }
  }

  return { results };
}

module.exports = {
  PROVIDER,
  stravaConnectionStatus,
  requireStravaAccessToken,
  listStravaActivitiesForUser,
  importStravaActivitiesByExternalIds,
};
