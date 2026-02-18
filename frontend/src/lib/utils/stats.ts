export interface StatIcon {
  type: 'material' | 'svg'
  name: string
}

/**
 * Maps stat type names (from API) to icon information.
 * Stat names come from the API as strings like "Duration", "Distance", "Average Heart Rate", etc.
 */
export function getStatIcon(statType: string): StatIcon | null {
  const lower = statType.toLowerCase()

  // Duration / Time
  if (lower === 'duration' || lower === 'time') {
    return { type: 'material', name: 'access_time' }
  }

  // Moving Time
  if (lower === 'moving time' || lower === 'movingtime') {
    return { type: 'svg', name: 'moving-time' }
  }

  // Distance
  if (lower === 'distance') {
    return { type: 'material', name: 'trending_flat' }
  }

  // Heart Rate
  if (
    lower.includes('heart rate') ||
    lower.includes('heartrate') ||
    lower === 'average heart rate' ||
    lower === 'min heart rate' ||
    lower === 'max heart rate'
  ) {
    return { type: 'svg', name: 'heart_pulse' }
  }

  // Energy / Calories
  if (lower === 'energy' || lower === 'calories' || lower.includes('calorie')) {
    return { type: 'svg', name: 'energy' }
  }

  // Speed
  if (lower === 'speed' || lower === 'average speed' || lower.includes('speed')) {
    return { type: 'material', name: 'speed' }
  }

  // Cadence
  if (lower === 'cadence' || lower === 'average cadence' || lower.includes('cadence')) {
    return { type: 'material', name: 'cached' }
  }

  // Power
  if (lower === 'power' || lower === 'average power' || lower.includes('power')) {
    return { type: 'material', name: 'bolt' }
  }

  // Ascent
  if (lower === 'ascent' || lower.includes('ascent')) {
    return { type: 'svg', name: 'arrow_up_right' }
  }

  // Descent
  if (lower === 'descent' || lower.includes('descent')) {
    return { type: 'svg', name: 'arrow_down_right' }
  }

  // Altitude Max
  if (lower === 'altitude max' || lower === 'max altitude' || lower.includes('altitude max')) {
    return { type: 'material', name: 'vertical_align_top' }
  }

  // Altitude Min
  if (lower === 'altitude min' || lower === 'min altitude' || lower.includes('altitude min')) {
    return { type: 'material', name: 'vertical_align_bottom' }
  }

  return null
}

/** Material Icons name for display (maps custom SVG names to Material equivalents). */
const SVG_TO_MATERIAL: Record<string, string> = {
  'moving-time': 'schedule',
  heart_pulse: 'favorite',
  energy: 'local_fire_department',
  arrow_up_right: 'trending_up',
  arrow_down_right: 'trending_down',
}

export function getStatIconMaterialName(statIcon: StatIcon): string {
  if (statIcon.type === 'material') return statIcon.name
  return SVG_TO_MATERIAL[statIcon.name] ?? 'info'
}

/**
 * Gets a display unit for a stat type (e.g. "s", "km", "bpm").
 * API does not return units; these are sensible defaults.
 */
export function getStatUnit(statType: string): string {
  const lower = statType.toLowerCase()
  if (lower === 'duration' || lower === 'time' || lower === 'moving time' || lower === 'movingtime')
    return 's'
  if (lower === 'distance') return 'm'
  if (lower.includes('heart rate') || lower.includes('heartrate')) return 'bpm'
  if (lower === 'energy' || lower.includes('calorie')) return 'kcal'
  if (lower.includes('speed')) return 'm/s'
  if (lower.includes('cadence')) return 'rpm'
  if (lower.includes('power')) return 'W'
  if (lower.includes('ascent') || lower.includes('descent') || lower.includes('altitude'))
    return 'm'
  return ''
}

/**
 * Gets a display label for a stat type.
 * Returns the stat type name with basic formatting.
 */
export function getStatLabel(statType: string): string {
  // Capitalize first letter of each word
  return statType
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

/**
 * Formats a stat value for display.
 * Handles numbers, strings, arrays, and objects.
 */
export function formatStatValue(
  value: number | string | number[] | Record<string, unknown> | undefined | null
): string {
  if (value == null) return ''
  if (Array.isArray(value)) {
    return value.join(', ')
  }
  if (typeof value === 'object') {
    return JSON.stringify(value)
  }
  return String(value)
}

/**
 * Gets stat categories for filtering/grouping stats.
 */
export const STAT_CATEGORIES = {
  OVERALL: [
    'Duration',
    'Moving Time',
    'Distance',
    'Speed',
    'Average Speed',
    'Cadence',
    'Average Cadence',
    'Power',
    'Average Power',
    'Ascent',
    'Descent',
    'Altitude Max',
    'Altitude Min',
  ],
  PERFORMANCE: [
    'Average Heart Rate',
    'Min Heart Rate',
    'Max Heart Rate',
    'Heart Rate',
    'Speed',
    'Average Speed',
    'Power',
    'Average Power',
    'Cadence',
    'Average Cadence',
  ],
  PHYSIOLOGICAL: ['Energy', 'Calories', 'Average Heart Rate', 'Heart Rate'],
} as const

/**
 * Checks if a stat type belongs to a category.
 */
export function isStatInCategory(statType: string, category: keyof typeof STAT_CATEGORIES): boolean {
  const lower = statType.toLowerCase()
  return STAT_CATEGORIES[category].some((catStat) => {
    const catLower = catStat.toLowerCase()
    return lower === catLower || lower.includes(catLower) || catLower.includes(lower)
  })
}

export interface StatEntry {
  statType: string
  value: string
  unit: string
}

export interface GroupedStats {
  overall: StatEntry[]
  performance: StatEntry[]
  physiological: StatEntry[]
}

/**
 * Groups stat entries by category in a single pass, avoiding duplicates.
 * Stats are assigned to the first matching category (OVERALL > PERFORMANCE > PHYSIOLOGICAL).
 */
export function groupStatsByCategory(entries: StatEntry[]): GroupedStats {
  const seen = new Set<string>()
  const result: GroupedStats = {
    overall: [],
    performance: [],
    physiological: [],
  }

  for (const entry of entries) {
    if (!getStatIcon(entry.statType) || seen.has(entry.statType)) continue

    if (isStatInCategory(entry.statType, 'OVERALL')) {
      result.overall.push(entry)
      seen.add(entry.statType)
    } else if (isStatInCategory(entry.statType, 'PERFORMANCE')) {
      result.performance.push(entry)
      seen.add(entry.statType)
    } else if (isStatInCategory(entry.statType, 'PHYSIOLOGICAL')) {
      result.physiological.push(entry)
      seen.add(entry.statType)
    }
  }

  return result
}
