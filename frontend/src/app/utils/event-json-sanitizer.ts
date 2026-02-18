import { DynamicDataLoader } from '@sports-alliance/sports-lib';

export class EventJSONSanitizer {
  static sanitize(json: unknown): { sanitizedJson: unknown; unknownTypes: string[] } {
    const unknownTypes = new Set<string>();
    if (!json || typeof json !== 'object') {
      return { sanitizedJson: json, unknownTypes: [] };
    }
    const sanitizedJson = { ...(json as Record<string, unknown>) };
    if (sanitizedJson['stats']) {
      sanitizedJson['stats'] = this.sanitizeStats(sanitizedJson['stats'] as Record<string, unknown>, unknownTypes);
    }
    if (Array.isArray(sanitizedJson['activities'])) {
      sanitizedJson['activities'] = (sanitizedJson['activities'] as unknown[]).map((activity) => {
        const a = { ...(activity as Record<string, unknown>) };
        // Ensure required fields exist
        if (!a['stats'] || typeof a['stats'] !== 'object' || a['stats'] === null) a['stats'] = {};
        if (!Array.isArray(a['laps'])) a['laps'] = [];
        if (!Array.isArray(a['events'])) a['events'] = [];
        if (!Array.isArray(a['intensityZones'])) a['intensityZones'] = [];
        if (!a['creator'] || typeof a['creator'] !== 'object' || a['creator'] === null) {
          a['creator'] = { name: '', isRecognized: false };
        }
        if (a['stats']) a['stats'] = this.sanitizeStats(a['stats'] as Record<string, unknown>, unknownTypes);
        if (a['streams']) a['streams'] = this.sanitizeStreams(a['streams'], unknownTypes);
        return a;
      });
    }
    return { sanitizedJson, unknownTypes: Array.from(unknownTypes) };
  }

  private static sanitizeStats(stats: Record<string, unknown>, unknownTypes: Set<string>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const type of Object.keys(stats)) {
      const value = stats[type];
      // Skip null, undefined, and NaN values - they cause parsing errors
      if (value === null || value === undefined || (typeof value === 'number' && isNaN(value))) {
        continue;
      }
      // Check if the data type is valid
      try {
        if (!DynamicDataLoader.getDataClassFromDataType(type)) {
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

  private static sanitizeStreams(streams: unknown, unknownTypes: Set<string>): unknown {
    if (Array.isArray(streams)) {
      return streams.filter((s: { type?: string }) => {
        const type = s?.type;
        if (!type) return true;
        try {
          return !!DynamicDataLoader.getDataClassFromDataType(type);
        } catch {
          unknownTypes.add(type);
          return false;
        }
      });
    }
    if (streams && typeof streams === 'object') {
      const out = { ...(streams as Record<string, unknown>) };
      for (const type of Object.keys(out)) {
        try {
          if (!DynamicDataLoader.getDataClassFromDataType(type)) {
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
