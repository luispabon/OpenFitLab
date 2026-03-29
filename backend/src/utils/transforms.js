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
  return {
    id: row.id,
    startDate: Number(row.start_date),
    name: row.name,
    ...(row.end_date != null ? { endDate: Number(row.end_date) } : {}),
    ...(row.description != null ? { description: row.description } : {}),
    ...(row.is_merge === 1 ? { isMerge: true } : {}),
    stats: statsForEvent || {},
    ...(row.src_file_type != null ? { srcFileType: row.src_file_type } : {}),
    ...(row.import_provider != null && row.import_external_id != null
      ? {
          importProvider: row.import_provider,
          importExternalId: String(row.import_external_id),
        }
      : {}),
    ...(row.start_timezone != null ? { startTimezone: row.start_timezone } : {}),
    ...(row.end_timezone != null ? { endTimezone: row.end_timezone } : {}),
    folderId: row.folder_id ?? null,
  };
}

function mapActivityRow(row, statsForActivity = {}) {
  return {
    id: row.id,
    eventID: row.event_id,
    ...(row.name != null ? { name: row.name } : {}),
    ...(row.start_date != null ? { startDate: Number(row.start_date) } : {}),
    ...(row.end_date != null ? { endDate: Number(row.end_date) } : {}),
    ...(row.type != null ? { type: row.type } : {}),
    stats: statsForActivity || {},
    ...(row.device_name != null ? { deviceName: row.device_name } : {}),
    ...(row.start_timezone != null ? { startTimezone: row.start_timezone } : {}),
    ...(row.end_timezone != null ? { endTimezone: row.end_timezone } : {}),
  };
}

module.exports = {
  parseJSONField,
  toTimestamp,
  aggregateStats,
  mapEventRow,
  mapActivityRow,
};
