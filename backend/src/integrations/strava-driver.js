/**
 * Strava API v3 driver (no Express/SQL). Uses bounded concurrency for per-activity HTTP calls;
 * Strava has no batch activity-by-id endpoint — see docs/integrations/strava-stage1-notes.md.
 */

const { StravaTokenExpiredError, StravaRateLimitError, StravaUpstreamError } = require('../errors');

const STRAVA_API = 'https://www.strava.com/api/v3';

/** @type {Record<string, string>} */
const STRAVA_SPORT_TO_OFL = {
  Run: 'Running',
  TrailRun: 'Running',
  VirtualRun: 'Running',
  Ride: 'Cycling',
  VirtualRide: 'Cycling',
  EBikeRide: 'Cycling',
  EMountainBikeRide: 'Cycling',
  MountainBikeRide: 'Cycling',
  GravelRide: 'Cycling',
  Velomobile: 'Cycling',
  Swim: 'Swimming',
  Walk: 'Walking',
  Hike: 'Hiking',
  Workout: 'Other',
  WeightTraining: 'Other',
  Yoga: 'Other',
  Crossfit: 'Other',
  Elliptical: 'Other',
  StairStepper: 'Other',
  Rowing: 'Other',
  Kayaking: 'Other',
  Canoeing: 'Other',
  StandUpPaddling: 'Other',
  Surfing: 'Other',
  Windsurf: 'Other',
  Kitesurf: 'Other',
  Snowboard: 'Other',
  AlpineSki: 'Other',
  NordicSki: 'Other',
  BackcountrySki: 'Other',
  Snowshoe: 'Other',
  IceSkate: 'Other',
  InlineSkate: 'Other',
  RockClimbing: 'Other',
  Soccer: 'Other',
  Tennis: 'Other',
  Golf: 'Other',
};

const STREAM_KEYS = 'time,distance,latlng,altitude,heartrate,cadence,watts,temp,velocity_smooth';

function parseStravaTimezone(tz) {
  if (!tz || typeof tz !== 'string') return null;
  const m = tz.match(/\)\s*([A-Za-z_/]+)\s*$/);
  return m ? m[1].trim() : null;
}

function mapActivityType(detail) {
  const sport = detail && detail.sport_type != null ? String(detail.sport_type) : '';
  if (sport && STRAVA_SPORT_TO_OFL[sport]) return STRAVA_SPORT_TO_OFL[sport];
  return 'Other';
}

function buildActivityStats(detail) {
  const stats = {};
  if (detail.distance != null && !Number.isNaN(Number(detail.distance))) {
    stats.Distance = Number(detail.distance);
  }
  const dur =
    detail.moving_time != null
      ? Number(detail.moving_time)
      : detail.elapsed_time != null
        ? Number(detail.elapsed_time)
        : null;
  if (dur != null && !Number.isNaN(dur)) {
    stats.Duration = dur;
  }
  if (detail.total_elevation_gain != null && !Number.isNaN(Number(detail.total_elevation_gain))) {
    stats.Ascent = Number(detail.total_elevation_gain);
  }
  if (detail.average_heartrate != null && !Number.isNaN(Number(detail.average_heartrate))) {
    stats['Average Heart Rate'] = Math.round(Number(detail.average_heartrate));
  }
  if (detail.max_heartrate != null && !Number.isNaN(Number(detail.max_heartrate))) {
    stats['Maximum Heart Rate'] = Math.round(Number(detail.max_heartrate));
  }
  if (detail.average_watts != null && !Number.isNaN(Number(detail.average_watts))) {
    stats['Average Power'] = Math.round(Number(detail.average_watts));
  }
  if (detail.kilojoules != null && !Number.isNaN(Number(detail.kilojoules))) {
    stats.Energy = Math.round(Number(detail.kilojoules));
  } else if (detail.calories != null && !Number.isNaN(Number(detail.calories))) {
    stats.Energy = Math.round(Number(detail.calories));
  }
  if (detail.average_speed != null && !Number.isNaN(Number(detail.average_speed))) {
    stats['Average Speed'] = Number(detail.average_speed);
  }
  return stats;
}

/**
 * Strava stream array → sports-lib-style streams map for stream-extractor.
 * @param {Array<{ type: string, data: unknown[] }>} streamArray
 */
function stravaStreamsToCanonicalMap(streamArray) {
  const byType = {};
  for (const s of streamArray || []) {
    if (s && s.type && Array.isArray(s.data)) {
      byType[String(s.type).toLowerCase()] = s.data;
    }
  }
  /** @type {Record<string, unknown[]>} */
  const streams = {};
  if (byType.time) streams.Time = byType.time;
  if (byType.distance) streams.Distance = byType.distance;
  if (byType.altitude) streams.Altitude = byType.altitude;
  if (byType.heartrate) streams['Heart Rate'] = byType.heartrate;
  if (byType.cadence) streams.Cadence = byType.cadence;
  if (byType.watts) streams.Power = byType.watts;
  if (byType.temp) streams.Temperature = byType.temp;
  if (byType.velocity_smooth) streams.Speed = byType.velocity_smooth;
  if (byType.latlng) {
    streams.Position = byType.latlng
      .filter((pair) => Array.isArray(pair) && pair.length >= 2)
      .map(([lat, lng]) => ({ lat: Number(lat), lng: Number(lng) }));
  }
  return streams;
}

/**
 * @param {object} detail - Strava GET /activities/{id} JSON
 * @param {Array<{ type: string, data: unknown[] }>} streamsArray - GET /activities/{id}/streams
 * @returns {{ eventJson: object, activitiesData: Array<{ activityJson: object }> }}
 */
function normalizeStravaToCanonical(detail, streamsArray) {
  const startMs = new Date(detail.start_date).getTime();
  const elapsedSec =
    detail.elapsed_time != null ? Number(detail.elapsed_time) : Number(detail.moving_time) || 0;
  const endMs = startMs + (Number.isFinite(elapsedSec) ? elapsedSec * 1000 : 0);

  const ianaTz = parseStravaTimezone(detail.timezone);
  const activityStats = buildActivityStats(detail);
  const streams = stravaStreamsToCanonicalMap(streamsArray);

  const activityJson = {
    name: detail.name != null ? String(detail.name) : 'Activity',
    startDate: startMs,
    endDate: endMs,
    type: mapActivityType(detail),
    stats: activityStats,
    streams: Object.keys(streams).length ? streams : null,
    creator:
      detail.device_name != null && String(detail.device_name).trim()
        ? { name: String(detail.device_name).trim() }
        : null,
    ...(ianaTz ? { startTimezone: ianaTz, endTimezone: ianaTz } : {}),
  };

  const eventJson = {
    name: activityJson.name,
    startDate: startMs,
    endDate: endMs,
    stats: {},
    description: null,
    isMerge: false,
  };

  return {
    eventJson,
    activitiesData: [{ activityJson }],
  };
}

function parseRetryAfterSeconds(res) {
  const h = res.headers.get('retry-after');
  if (!h) return null;
  const n = parseInt(h, 10);
  return Number.isFinite(n) ? n : null;
}

async function throwForStatus(res) {
  if (res.status === 401) {
    throw new StravaTokenExpiredError();
  }
  if (res.status === 429) {
    throw new StravaRateLimitError(parseRetryAfterSeconds(res));
  }
  if (!res.ok) {
    let msg = `Strava API error (${res.status})`;
    try {
      const text = await res.text();
      const j = JSON.parse(text);
      if (j && j.message) msg = String(j.message);
    } catch {
      /* ignore */
    }
    throw new StravaUpstreamError(msg);
  }
}

/**
 * @param {string} accessToken
 * @param {string} pathWithQuery - e.g. /athlete/activities?page=1
 * @param {{ timeoutMs?: number }} [options]
 */
async function stravaGet(accessToken, pathWithQuery, options = {}) {
  const url = pathWithQuery.startsWith('http') ? pathWithQuery : `${STRAVA_API}${pathWithQuery}`;
  const timeoutMs = options.timeoutMs ?? 45000;
  const res = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(timeoutMs),
  });
  await throwForStatus(res);
  return res.json();
}

async function listActivities(accessToken, { page = 1, perPage = 30 } = {}) {
  const p = Math.max(1, Math.min(200, Number(perPage) || 30));
  const pg = Math.max(1, Number(page) || 1);
  return stravaGet(accessToken, `/athlete/activities?page=${pg}&per_page=${p}`);
}

async function fetchActivityDetail(accessToken, id, options) {
  return stravaGet(accessToken, `/activities/${encodeURIComponent(id)}`, options);
}

async function fetchActivityStreams(accessToken, id, options) {
  const q = `/activities/${encodeURIComponent(id)}/streams?keys=${encodeURIComponent(STREAM_KEYS)}`;
  return stravaGet(accessToken, q, options);
}

/**
 * Fetch detail + streams for one activity id.
 */
async function fetchActivityBundle(accessToken, id, options = {}) {
  const [detail, streams] = await Promise.all([
    fetchActivityDetail(accessToken, id, options),
    fetchActivityStreams(accessToken, id, options).catch(() => []),
  ]);
  return { detail, streams: Array.isArray(streams) ? streams : [] };
}

/**
 * Parallel batches of `concurrency` (default 5) to limit load on Strava.
 */
async function fetchActivitiesForImport(accessToken, ids, options = {}) {
  const concurrency = Math.max(1, Math.min(10, Number(options.concurrency) || 5));
  const out = [];
  for (let i = 0; i < ids.length; i += concurrency) {
    const chunk = ids.slice(i, i + concurrency);
    const part = await Promise.all(
      chunk.map((id) => fetchActivityBundle(accessToken, String(id), options))
    );
    out.push(...part);
  }
  return out;
}

module.exports = {
  STRAVA_API,
  STREAM_KEYS,
  parseStravaTimezone,
  mapActivityType,
  buildActivityStats,
  stravaStreamsToCanonicalMap,
  normalizeStravaToCanonical,
  stravaGet,
  listActivities,
  fetchActivityDetail,
  fetchActivityStreams,
  fetchActivityBundle,
  fetchActivitiesForImport,
};
