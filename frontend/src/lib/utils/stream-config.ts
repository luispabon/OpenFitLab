/**
 * Configuration for stream types: colors, labels, units, and chartability
 */

export interface StreamConfig {
  color: string
  unit: string
  label: string
  chartable: boolean
}

/**
 * Stream type configuration map
 * Colors chosen to work well in both light and dark modes
 */
const STREAM_CONFIG: Record<string, StreamConfig> = {
  'Heart Rate': {
    color: '#ef4444', // red-500
    unit: 'bpm',
    label: 'Heart Rate',
    chartable: true,
  },
  Cadence: {
    color: '#f97316', // orange-500
    unit: 'rpm',
    label: 'Cadence',
    chartable: true,
  },
  Speed: {
    color: '#3b82f6', // blue-500
    unit: 'm/s',
    label: 'Speed',
    chartable: true,
  },
  Altitude: {
    color: '#10b981', // green-500
    unit: 'm',
    label: 'Altitude',
    chartable: true,
  },
  Power: {
    color: '#a855f7', // purple-500
    unit: 'W',
    label: 'Power',
    chartable: true,
  },
  Temperature: {
    color: '#f59e0b', // amber-500
    unit: '°C',
    label: 'Temperature',
    chartable: true,
  },
  Distance: {
    color: '#14b8a6', // teal-500
    unit: 'm',
    label: 'Distance',
    chartable: true,
  },
  Grade: {
    color: '#6366f1', // indigo-500
    unit: '%',
    label: 'Grade',
    chartable: true,
  },
  'Vertical Speed': {
    color: '#06b6d4', // cyan-500
    unit: 'm/s',
    label: 'Vertical Speed',
    chartable: true,
  },
  Time: {
    color: '#6b7280', // gray-500
    unit: '',
    label: 'Time',
    chartable: false, // Used for timestamps, not charted directly
  },
  Duration: {
    color: '#6b7280', // gray-500
    unit: '',
    label: 'Duration',
    chartable: false, // Used for timestamps, not charted directly
  },
}

/**
 * Get configuration for a stream type
 * Returns a generic fallback config for unknown stream types
 */
export function getStreamConfig(type: string): StreamConfig {
  const normalized = type.trim()
  const config = STREAM_CONFIG[normalized]
  
  if (config) {
    return config
  }
  
  // Generic fallback for unknown stream types
  return {
    color: '#6b7280', // gray-500
    unit: '',
    label: normalized,
    chartable: true, // Assume chartable unless we know otherwise
  }
}

/**
 * Check if a stream type should be charted
 * Filters out Time/Duration streams which are used for timestamps
 */
export function isChartableStream(type: string): boolean {
  const config = getStreamConfig(type)
  return config.chartable
}

/**
 * Get all configured stream types (for reference)
 */
export function getKnownStreamTypes(): string[] {
  return Object.keys(STREAM_CONFIG)
}
