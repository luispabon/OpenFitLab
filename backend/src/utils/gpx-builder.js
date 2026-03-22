'use strict';

/**
 * Pure GPX XML serializer. No DB dependency.
 * Only emits trackpoints anchored to GPS coordinates.
 * Returns null if no activity has GPS data.
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
 * Returns true if the stream map contains GPS data.
 * @param {Record<string, any[]>|null} streamMap
 * @returns {boolean}
 */
function hasGpsStreams(streamMap) {
  if (!streamMap) return false;
  const hasSeparate = 'Latitude' in streamMap && 'Longitude' in streamMap;
  const hasCombined = 'Position' in streamMap;
  return hasSeparate || hasCombined;
}

/**
 * Builds a complete GPX XML document.
 * Returns null if no activity has GPS streams.
 * @param {object} event - raw event DB row
 * @param {object[]} activities - raw activity DB rows
 * @param {Record<string, Record<string, Array<{time: number, value: any}>>>} streamsByActivityId
 * @returns {string|null} GPX XML document or null
 */
function buildGpx(event, activities, streamsByActivityId) {
  const gpsActivities = activities.filter((a) => hasGpsStreams(streamsByActivityId[a.id] ?? {}));
  if (gpsActivities.length === 0) return null;

  const eventName = escapeXml(event.name ?? '');
  const eventStartIso = toIso8601(event.start_date);

  const segments = gpsActivities
    .map((activity) => {
      const streamMap = streamsByActivityId[activity.id] ?? {};
      const trackpoints = buildTrackpoints(streamMap);

      const tpLines = trackpoints
        .map((tp) => {
          const s = tp.streams;

          let lat = s['Latitude'] ?? null;
          let lon = s['Longitude'] ?? null;
          if (lat == null && lon == null && s['Position'] != null) {
            const pos = s['Position'];
            if (Array.isArray(pos) && pos.length >= 2) {
              lat = pos[0];
              lon = pos[1];
            }
          }

          // GPX is GPS-anchored — skip trackpoints without resolved coordinates
          if (lat == null || lon == null) return null;

          const lines = [];
          lines.push(`      <trkpt lat="${lat}" lon="${lon}">`);
          if (s['Altitude'] != null) lines.push(`        <ele>${s['Altitude']}</ele>`);
          lines.push(`        <time>${toIso8601(tp.timeMs)}</time>`);

          const extFields = [];
          if (s['Heart Rate'] != null)
            extFields.push(`          <gpxtpx:hr>${s['Heart Rate']}</gpxtpx:hr>`);
          if (s['Cadence'] != null)
            extFields.push(`          <gpxtpx:cad>${s['Cadence']}</gpxtpx:cad>`);
          if (s['Temperature'] != null)
            extFields.push(`          <gpxtpx:atemp>${s['Temperature']}</gpxtpx:atemp>`);
          if (s['Power'] != null)
            extFields.push(`          <gpxtpx:power>${s['Power']}</gpxtpx:power>`);

          if (extFields.length > 0) {
            lines.push('        <extensions>');
            lines.push('          <gpxtpx:TrackPointExtension>');
            lines.push(...extFields);
            lines.push('          </gpxtpx:TrackPointExtension>');
            lines.push('        </extensions>');
          }

          lines.push('      </trkpt>');
          return lines.join('\n');
        })
        .filter(Boolean);

      if (tpLines.length === 0) return null;

      return ['    <trkseg>', ...tpLines, '    </trkseg>'].join('\n');
    })
    .filter(Boolean);

  if (segments.length === 0) return null;

  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="OpenFitLab"',
    '  xmlns="http://www.topografix.com/GPX/1/1"',
    '  xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1"',
    '  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
    '  xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd http://www.garmin.com/xmlschemas/TrackPointExtension/v1 http://www.garmin.com/xmlschemas/TrackPointExtensionv1.xsd">',
    '  <metadata>',
    `    <name>${eventName}</name>`,
    `    <time>${eventStartIso}</time>`,
    '  </metadata>',
    '  <trk>',
    `    <name>${eventName}</name>`,
    ...segments,
    '  </trk>',
    '</gpx>',
  ];

  return lines.join('\n');
}

module.exports = { buildGpx, hasGpsStreams };
