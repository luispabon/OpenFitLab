/**
 * Utility functions for extracting stream data with timestamps from parsed activities
 */

/**
 * Convert stream JSON format to data points
 * Handles both array format and object map format from toJSON()
 * @param {Object} activityJson - Activity JSON from toJSON()
 * @param {number} activityStartDateMs - Activity start date in milliseconds
 * @returns {Array<{type: string, dataPoints: Array<{time: number, value: any}>}>}
 */
function extractStreamDataPointsFromJSON(activityJson, activityStartDateMs) {
  const streams = [];

  if (!activityJson || !activityJson.streams) {
    return streams;
  }

  let streamsArray = [];

  // Handle different stream formats
  if (Array.isArray(activityJson.streams)) {
    streamsArray = activityJson.streams;
  } else if (typeof activityJson.streams === 'object') {
    // Object map format: { 'Heart Rate': [...], 'Distance': [...] }
    streamsArray = Object.entries(activityJson.streams).map(([type, data]) => ({
      type,
      data: Array.isArray(data)
        ? data
        : data && typeof data === 'object' && 'data' in data
          ? data.data
          : data,
    }));
  }

  // Find Time stream for timestamp extraction
  const timeStream = streamsArray.find((s) => s.type === 'Time');
  const timeData = timeStream && Array.isArray(timeStream.data) ? timeStream.data : null;

  // Determine if Time stream contains absolute timestamps or offsets
  // TCX files have absolute ISO 8601 timestamps, FIT files typically have offsets
  let timeStreamHasAbsoluteTimestamps = false;
  if (timeData && timeData.length > 0) {
    const firstTimeValue = timeData[0];
    // Check if it's a Date object, ISO string, or large number (absolute timestamp)
    if (firstTimeValue instanceof Date) {
      timeStreamHasAbsoluteTimestamps = true;
    } else if (
      typeof firstTimeValue === 'string' &&
      firstTimeValue.includes('T') &&
      firstTimeValue.includes('Z')
    ) {
      timeStreamHasAbsoluteTimestamps = true;
    } else if (typeof firstTimeValue === 'number' && firstTimeValue > 1000000000000) {
      // Unix timestamp in milliseconds (absolute)
      timeStreamHasAbsoluteTimestamps = true;
    }
  }

  // Process each stream
  for (const stream of streamsArray) {
    if (!stream || !stream.type || !stream.data) {
      continue;
    }

    const streamData = Array.isArray(stream.data) ? stream.data : [];
    if (streamData.length === 0) {
      continue;
    }

    // Extract timestamps
    let timestamps;
    if (stream.type === 'Time') {
      if (timeStreamHasAbsoluteTimestamps) {
        // Absolute timestamps - convert to milliseconds
        timestamps = streamData.map((timeValue) => {
          if (timeValue instanceof Date) {
            return timeValue.getTime();
          } else if (typeof timeValue === 'string') {
            return new Date(timeValue).getTime();
          } else if (typeof timeValue === 'number') {
            // Already in milliseconds or seconds?
            return timeValue > 1000000000000 ? timeValue : timeValue * 1000;
          }
          return activityStartDateMs;
        });
      } else {
        // Offsets in seconds - convert to absolute timestamps
        timestamps = streamData.map((offsetSeconds) => activityStartDateMs + offsetSeconds * 1000);
      }
    } else if (timeData && timeData.length === streamData.length) {
      if (timeStreamHasAbsoluteTimestamps) {
        // Use absolute timestamps from Time stream
        timestamps = timeData.map((timeValue) => {
          if (timeValue instanceof Date) {
            return timeValue.getTime();
          } else if (typeof timeValue === 'string') {
            return new Date(timeValue).getTime();
          } else if (typeof timeValue === 'number') {
            return timeValue > 1000000000000 ? timeValue : timeValue * 1000;
          }
          return activityStartDateMs;
        });
      } else {
        // Use Time stream offsets
        timestamps = timeData.map((offsetSeconds) => activityStartDateMs + offsetSeconds * 1000);
      }
    } else {
      // Fallback: assume 1-second intervals
      timestamps = streamData.map((_, index) => activityStartDateMs + index * 1000);
    }

    // Create data points, filtering out null values
    const dataPoints = streamData
      .map((value, index) => ({
        time: timestamps[index] || activityStartDateMs + index * 1000,
        value: value,
      }))
      .filter(
      (dp) =>
        dp.value !== null &&
        dp.value !== undefined &&
        (typeof dp.value !== 'number' || !isNaN(dp.value))
    );

    // Only include streams that have at least one valid data point
    if (dataPoints.length > 0) {
      streams.push({
        type: stream.type,
        dataPoints: dataPoints,
      });
    }
  }

  return streams;
}

module.exports = {
  extractStreamDataPointsFromJSON,
};
