/**
 * Extract IANA timezone identifier from sports-lib parsed data.
 * ISO 8601 strings with "Z" or "+00:00" are mapped to "UTC".
 * Other offsets are not mapped to IANA (would require external lookup).
 *
 * @param {Date|string|number} dateValue - Date object, ISO string, or ms from sports-lib
 * @returns {string|null} - IANA timezone like "UTC" or "America/New_York", or null
 */
function extractTimezoneFromValue(dateValue) {
  if (dateValue === null || dateValue === undefined) return null;

  if (typeof dateValue === 'string') {
    const s = dateValue.trim();
    if (s.endsWith('Z') || s.includes('+00:00') || s.endsWith('-00:00')) {
      return 'UTC';
    }
    // ISO with offset e.g. "2024-01-15T14:30:00-05:00" - we don't map offset to IANA here
    return null;
  }

  if (dateValue instanceof Date || typeof dateValue === 'number') {
    return null;
  }

  return null;
}

/**
 * Alias for extractTimezoneFromValue for single-value extraction.
 */
function extractTimezone(dateValue) {
  return extractTimezoneFromValue(dateValue);
}

/**
 * Extract timezone from activity JSON (from activity.toJSON()).
 *
 * @param {Object} activityJson - Activity from activity.toJSON()
 * @returns {{ startTimezone: string|null, endTimezone: string|null }}
 */
function extractActivityTimezones(activityJson) {
  if (!activityJson || typeof activityJson !== 'object') {
    return { startTimezone: null, endTimezone: null };
  }
  const explicitStart =
    typeof activityJson.startTimezone === 'string' && activityJson.startTimezone.trim()
      ? activityJson.startTimezone.trim()
      : null;
  const explicitEnd =
    typeof activityJson.endTimezone === 'string' && activityJson.endTimezone.trim()
      ? activityJson.endTimezone.trim()
      : null;
  return {
    startTimezone: explicitStart ?? extractTimezoneFromValue(activityJson.startDate),
    endTimezone: explicitEnd ?? extractTimezoneFromValue(activityJson.endDate),
  };
}

module.exports = {
  extractTimezone,
  extractTimezoneFromValue,
  extractActivityTimezones,
};
