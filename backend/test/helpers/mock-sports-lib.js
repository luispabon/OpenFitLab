/**
 * Mock for @sports-alliance/sports-lib DynamicDataLoader.getDataClassFromDataType.
 * Used by json-sanitizer tests to avoid depending on real sports-lib for known/unknown types.
 */

const KNOWN_STAT_TYPES = new Set([
  'Distance',
  'Duration',
  'Heart Rate',
  'Speed',
  'Power',
  'Cadence',
  'Altitude',
  'Temperature',
]);
const KNOWN_STREAM_TYPES = new Set(['Time', 'Heart Rate', 'Distance', 'Speed', 'Cadence']);

function getDataClassFromDataType(type) {
  return KNOWN_STAT_TYPES.has(type) || KNOWN_STREAM_TYPES.has(type) ? {} : null;
}

module.exports = { getDataClassFromDataType };
