const { DynamicDataLoader } = require('@sports-alliance/sports-lib');

function getDataClass(type) {
  return DynamicDataLoader.getDataClassFromDataType(type);
}

class JSONSanitizer {
  static sanitize(json, options = {}) {
    const getDataClassFromDataType = options.getDataClassFromDataType ?? getDataClass;
    const unknownTypes = new Set();
    if (!json || typeof json !== 'object') {
      return { sanitizedJson: json, unknownTypes: [] };
    }
    const sanitizedJson = { ...json };
    if (sanitizedJson.stats) {
      sanitizedJson.stats = this.sanitizeStats(
        sanitizedJson.stats,
        unknownTypes,
        getDataClassFromDataType
      );
    }
    if (Array.isArray(sanitizedJson.activities)) {
      sanitizedJson.activities = sanitizedJson.activities.map((activity) => {
        const a = { ...activity };
        // Ensure required fields exist
        if (!a.stats || typeof a.stats !== 'object' || a.stats === null) a.stats = {};
        if (!Array.isArray(a.laps)) a.laps = [];
        if (!Array.isArray(a.events)) a.events = [];
        if (!Array.isArray(a.intensityZones)) a.intensityZones = [];
        if (a.stats) a.stats = this.sanitizeStats(a.stats, unknownTypes, getDataClassFromDataType);
        // Sanitize laps stats
        if (Array.isArray(a.laps)) {
          a.laps = a.laps.map((lap) => {
            if (lap && typeof lap === 'object' && lap.stats) {
              return {
                ...lap,
                stats: this.sanitizeStats(lap.stats, unknownTypes, getDataClassFromDataType),
              };
            }
            return lap;
          });
        }
        if (a.streams)
          a.streams = this.sanitizeStreams(a.streams, unknownTypes, getDataClassFromDataType);
        return a;
      });
    }
    return { sanitizedJson, unknownTypes: Array.from(unknownTypes) };
  }

  static sanitizeStats(stats, unknownTypes, getDataClassFromDataType = getDataClass) {
    const out = {};
    for (const type of Object.keys(stats)) {
      const value = stats[type];
      // Skip null, undefined, and NaN values - they cause parsing errors
      if (value === null || value === undefined || (typeof value === 'number' && isNaN(value))) {
        continue;
      }
      // Check if the data type is valid
      try {
        if (!getDataClassFromDataType(type)) {
          unknownTypes.add(type);
          continue;
        }
        out[type] = value;
      } catch {
        unknownTypes.add(type);
        // Don't add to output
      }
    }
    return out;
  }

  static sanitizeStreams(streams, unknownTypes, getDataClassFromDataType = getDataClass) {
    if (Array.isArray(streams)) {
      return streams.filter((s) => {
        const type = s?.type;
        if (!type) return true;
        try {
          return !!getDataClassFromDataType(type);
        } catch {
          unknownTypes.add(type);
          return false;
        }
      });
    }
    if (streams && typeof streams === 'object') {
      const out = { ...streams };
      for (const type of Object.keys(out)) {
        try {
          if (!getDataClassFromDataType(type)) {
            unknownTypes.add(type);
            delete out[type];
          }
        } catch {
          unknownTypes.add(type);
          delete out[type];
        }
      }
      return out;
    }
    return streams;
  }
}

module.exports = JSONSanitizer;
