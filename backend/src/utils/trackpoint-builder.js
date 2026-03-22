'use strict';

/**
 * Shared trackpoint alignment utility.
 * Pure functions — no DB dependency.
 */

/**
 * Builds a sorted array of all unique timestamps across all streams.
 * @param {Record<string, Array<{time: number, value: any}>>} streamMap
 * @returns {number[]}
 */
function buildUnifiedTimeline(streamMap) {
  const timestamps = new Set();
  for (const stream of Object.values(streamMap)) {
    for (const point of stream) {
      timestamps.add(point.time);
    }
  }
  return Array.from(timestamps).sort((a, b) => a - b);
}

/**
 * Binary search for the nearest point within tolerance.
 * @param {Array<{time: number, value: any}>} stream - must be sorted ascending by time
 * @param {number} targetMs
 * @param {number} toleranceMs
 * @returns {any} value or null if nearest is beyond tolerance
 */
function resolveValue(stream, targetMs, toleranceMs = 30000) {
  if (!stream || stream.length === 0) return null;

  let lo = 0;
  let hi = stream.length - 1;

  // Find first index with time >= targetMs (or last index if all are < targetMs)
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (stream[mid].time < targetMs) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }

  // Compare lo and lo-1 to find the nearest
  let bestIdx = lo;
  if (lo > 0) {
    const prevDiff = Math.abs(stream[lo - 1].time - targetMs);
    const currDiff = Math.abs(stream[lo].time - targetMs);
    if (prevDiff < currDiff) bestIdx = lo - 1;
  }

  const diff = Math.abs(stream[bestIdx].time - targetMs);
  return diff <= toleranceMs ? stream[bestIdx].value : null;
}

/**
 * Builds unified trackpoints from a stream map.
 * @param {Record<string, Array<{time: number, value: any}>>} streamMap
 * @returns {Array<{timeMs: number, streams: Record<string, any>}>}
 */
function buildTrackpoints(streamMap) {
  const types = Object.keys(streamMap);
  if (types.length === 0) return [];

  const timeline = buildUnifiedTimeline(streamMap);
  return timeline.map((timeMs) => {
    const streams = {};
    for (const type of types) {
      const val = resolveValue(streamMap[type], timeMs);
      if (val !== null) {
        streams[type] = val;
      }
    }
    return { timeMs, streams };
  });
}

module.exports = { buildUnifiedTimeline, resolveValue, buildTrackpoints };
