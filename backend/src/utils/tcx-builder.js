'use strict';

/**
 * Pure TCX XML serializer. No DB dependency.
 * Accepts plain objects (already-fetched DB data).
 */

const { buildTrackpoints } = require('./trackpoint-builder');

function escapeXml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toIso8601(ms) {
  return new Date(Number(ms)).toISOString();
}

/**
 * Maps stored activity type to TCX Sport attribute.
 * @param {string|null} activityType
 * @returns {'Running'|'Biking'|'Other'}
 */
function toTcxSport(activityType) {
  if (!activityType) return 'Other';
  const lower = String(activityType).toLowerCase();
  if (lower === 'running') return 'Running';
  if (lower === 'cycling') return 'Biking';
  return 'Other';
}

/**
 * Sanitises a string for safe use as a filename.
 * @param {string|null} name
 * @param {string} fallback
 * @returns {string}
 */
function sanitizeFilename(name, fallback) {
  if (!name || typeof name !== 'string') return fallback;
  const sanitized = name
    .replace(/[/\\:*?"<>|]/g, '_')
    .replace(/[^\x20-\x7E]/g, '_') // strip non-ASCII
    .trim()
    .replace(/_+/g, '_')
    .substring(0, 100);
  return sanitized || fallback;
}

function buildTrackpointXml(tp) {
  const s = tp.streams;
  const lines = [];

  lines.push('          <Trackpoint>');
  lines.push(`            <Time>${toIso8601(tp.timeMs)}</Time>`);

  // Resolve position — prefer separate Latitude/Longitude; fall back to Position [lat, lon]
  let lat = s['Latitude'] ?? null;
  let lon = s['Longitude'] ?? null;
  if (lat == null && lon == null && s['Position'] != null) {
    const pos = s['Position'];
    if (Array.isArray(pos) && pos.length >= 2) {
      lat = pos[0];
      lon = pos[1];
    }
  }
  if (lat != null && lon != null) {
    lines.push('            <Position>');
    lines.push(`              <LatitudeDegrees>${lat}</LatitudeDegrees>`);
    lines.push(`              <LongitudeDegrees>${lon}</LongitudeDegrees>`);
    lines.push('            </Position>');
  }

  if (s['Altitude'] != null)
    lines.push(`            <AltitudeMeters>${s['Altitude']}</AltitudeMeters>`);
  if (s['Distance'] != null)
    lines.push(`            <DistanceMeters>${s['Distance']}</DistanceMeters>`);
  if (s['Heart Rate'] != null)
    lines.push(`            <HeartRateBpm><Value>${s['Heart Rate']}</Value></HeartRateBpm>`);
  if (s['Cadence'] != null) lines.push(`            <Cadence>${s['Cadence']}</Cadence>`);

  if (s['Speed'] != null || s['Power'] != null) {
    lines.push('            <Extensions>');
    lines.push('              <ns3:TPX>');
    if (s['Speed'] != null) lines.push(`                <ns3:Speed>${s['Speed']}</ns3:Speed>`);
    if (s['Power'] != null) lines.push(`                <ns3:Watts>${s['Power']}</ns3:Watts>`);
    lines.push('              </ns3:TPX>');
    lines.push('            </Extensions>');
  }

  lines.push('          </Trackpoint>');
  return lines.join('\n');
}

/**
 * Builds a complete TCX XML document.
 * @param {object} event - raw event DB row
 * @param {object[]} activities - raw activity DB rows
 * @param {Record<string, Record<string, number>>} statsByActivityId
 * @param {Record<string, Record<string, Array<{time: number, value: any}>>>} streamsByActivityId
 * @returns {string} TCX XML document
 */
function buildTcx(event, activities, statsByActivityId, streamsByActivityId) {
  const sport = toTcxSport(activities[0]?.type ?? null);
  const eventStartIso = toIso8601(event.start_date);

  const lapParts = activities.map((activity) => {
    const stats = statsByActivityId[activity.id] ?? {};
    const streamMap = streamsByActivityId[activity.id] ?? {};
    const startIso = activity.start_date != null ? toIso8601(activity.start_date) : eventStartIso;
    const trackpoints = buildTrackpoints(streamMap);

    const statLines = [];
    if (stats['Duration'] != null)
      statLines.push(`        <TotalTimeSeconds>${stats['Duration']}</TotalTimeSeconds>`);
    if (stats['Distance'] != null)
      statLines.push(`        <DistanceMeters>${stats['Distance']}</DistanceMeters>`);
    if (stats['Maximum Speed'] != null)
      statLines.push(`        <MaximumSpeed>${stats['Maximum Speed']}</MaximumSpeed>`);
    if (stats['Energy'] != null) statLines.push(`        <Calories>${stats['Energy']}</Calories>`);
    if (stats['Average Heart Rate'] != null)
      statLines.push(
        `        <AverageHeartRateBpm><Value>${stats['Average Heart Rate']}</Value></AverageHeartRateBpm>`
      );
    if (stats['Maximum Heart Rate'] != null)
      statLines.push(
        `        <MaximumHeartRateBpm><Value>${stats['Maximum Heart Rate']}</Value></MaximumHeartRateBpm>`
      );

    const tpXml = trackpoints.map(buildTrackpointXml).join('\n');

    const parts = [
      `      <Lap StartTime="${startIso}">`,
      ...statLines,
      '        <Intensity>Active</Intensity>',
      '        <TriggerMethod>Manual</TriggerMethod>',
      '        <Track>',
    ];
    if (tpXml) parts.push(tpXml);
    parts.push('        </Track>');
    parts.push('      </Lap>');
    return parts.join('\n');
  });

  // Creator uses first activity's device name
  const deviceName = activities[0]?.device_name ?? null;
  const creatorParts = deviceName
    ? [
        '      <Creator xsi:type="Device_t">',
        `        <Name>${escapeXml(deviceName)}</Name>`,
        '      </Creator>',
      ]
    : [];

  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"',
    '  xmlns:ns3="http://www.garmin.com/xmlschemas/ActivityExtension/v2"',
    '  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
    '  xsi:schemaLocation="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2 http://www.garmin.com/xmlschemas/TrainingCenterDatabasev2.xsd">',
    '  <Activities>',
    `    <Activity Sport="${sport}">`,
    `      <Id>${eventStartIso}</Id>`,
    ...lapParts,
    ...creatorParts,
    '    </Activity>',
    '  </Activities>',
    '</TrainingCenterDatabase>',
  ];

  return lines.join('\n');
}

module.exports = { buildTcx, toTcxSport, sanitizeFilename };
