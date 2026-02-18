function parseJSONField(value, defaultValue = null) {
  if (value === null || value === undefined) return defaultValue;
  return typeof value === 'object' ? value : JSON.parse(value);
}

function toTimestamp(value, defaultValue = null) {
  if (value === null || value === undefined) return defaultValue;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;

  const num = Number(value);
  return Number.isNaN(num) ? defaultValue : num;
}

function aggregateStats(rows, keyField) {
  const result = {};
  if (!Array.isArray(rows)) return result;

  for (const row of rows) {
    if (keyField) {
      const id = row[keyField];
      if (id == null) continue;
      if (!result[id]) result[id] = {};
      result[id][row.stat_type] = parseJSONField(row.value);
    } else {
      result[row.stat_type] = parseJSONField(row.value);
    }
  }

  return result;
}

function mapEventRow(row, statsForEvent = {}) {
  const payloadRest = parseJSONField(row.payload_rest, {});

  return {
    id: row.id,
    startDate: Number(row.start_date),
    name: row.name,
    privacy: row.privacy,
    ...(row.end_date != null ? { endDate: Number(row.end_date) } : {}),
    ...(row.description != null ? { description: row.description } : {}),
    ...(row.is_merge === 1 ? { isMerge: true } : {}),
    stats: statsForEvent || {},
    ...payloadRest,
  };
}

function mapActivityRow(row, statsForActivity = {}) {
  const payloadRest = parseJSONField(row.payload_rest, {});

  return {
    id: row.id,
    eventID: row.event_id,
    eventStartDate: row.event_start_date != null ? Number(row.event_start_date) : undefined,
    ...(row.name != null ? { name: row.name } : {}),
    ...(row.start_date != null ? { startDate: Number(row.start_date) } : {}),
    ...(row.end_date != null ? { endDate: Number(row.end_date) } : {}),
    ...(row.type != null ? { type: row.type } : {}),
    stats: statsForActivity || {},
    ...payloadRest,
  };
}

function extractPayloadRest(obj, keysToOmit) {
  const payload = { ...obj };
  for (const key of keysToOmit) {
    delete payload[key];
  }
  return payload;
}

function placeholders(count) {
  return Array.from({ length: count }, () => '?').join(',');
}

module.exports = {
  parseJSONField,
  toTimestamp,
  aggregateStats,
  mapEventRow,
  mapActivityRow,
  extractPayloadRest,
  placeholders,
};

