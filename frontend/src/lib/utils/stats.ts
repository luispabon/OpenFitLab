export interface StatIcon {
  type: 'material' | 'svg'
  name: string
}

// --- Parsed stat (sports-lib naming: [Aggregation] Metric [in UnitVariant]) ---

export interface ParsedStat {
  metric: string
  aggregation: string | null
  unitVariant: string | null
  original: string
}

const AGGREGATIONS = ['Average', 'Maximum', 'Minimum', 'Max', 'Min'] as const

/**
 * Extracts structure from sports-lib stat type names.
 * Pattern: [Aggregation] Metric [in UnitVariant], e.g. "Average Speed in Kilometers per Hour".
 */
export function parseStat(statType: string): ParsedStat {
  const trimmed = statType.trim()
  const inIndex = trimmed.toLowerCase().lastIndexOf(' in ')
  const unitVariant: string | null =
    inIndex >= 0 ? trimmed.slice(inIndex + 4).trim() : null
  const beforeUnit = inIndex >= 0 ? trimmed.slice(0, inIndex).trim() : trimmed

  let aggregation: string | null = null
  let metric = beforeUnit
  for (const agg of AGGREGATIONS) {
    if (
      beforeUnit.toLowerCase().startsWith(agg.toLowerCase() + ' ') &&
      beforeUnit.length > agg.length + 1
    ) {
      aggregation = agg
      metric = beforeUnit.slice(agg.length + 1).trim()
      break
    }
  }

  return {
    metric,
    aggregation,
    unitVariant,
    original: statType,
  }
}

/** Metric family -> display category label. Unrecognized metrics go to "Other". */
export const METRIC_CATEGORIES: Record<string, string> = {
  Duration: 'Time',
  'Moving Time': 'Time',
  Distance: 'Distance',
  Speed: 'Speed',
  'Heart Rate': 'Heart Rate',
  Cadence: 'Cadence',
  Power: 'Power',
  Ascent: 'Elevation',
  Descent: 'Elevation',
  'Altitude Min': 'Elevation',
  'Altitude Max': 'Elevation',
  Energy: 'Energy',
  Calories: 'Energy',
}

/** Preferred unit variant per metric; null = use base (no "in X"). Only this variant is kept. */
export const PREFERRED_UNITS: Record<string, string | null> = {
  Speed: 'Kilometers per Hour',
  'Heart Rate': null,
  Cadence: null,
  Power: null,
  Distance: null,
  Duration: null,
  'Moving Time': null,
  Ascent: null,
  Descent: null,
  'Altitude Min': null,
  'Altitude Max': null,
  Energy: null,
  Calories: null,
}

/** Key metric names (metric or "Aggregation Metric") to promote per activity type. */
export const KEY_METRICS: Record<string, string[]> = {
  running: ['Distance', 'Duration', 'Average Speed', 'Average Heart Rate', 'Ascent'],
  cycling: ['Distance', 'Duration', 'Average Power', 'Average Speed', 'Average Heart Rate'],
  swimming: ['Distance', 'Duration', 'Average Speed', 'Average Heart Rate'],
  default: ['Distance', 'Duration', 'Average Speed', 'Average Heart Rate', 'Energy'],
}

function getCategoryForMetric(metric: string): string {
  return METRIC_CATEGORIES[metric] ?? 'Other'
}

/**
 * Normalized key for (metric + aggregation) for key-metric matching.
 * e.g. "Average Speed" -> "Average Speed", "Distance" -> "Distance".
 */
function metricAggregationKey(parsed: ParsedStat): string {
  if (parsed.aggregation) {
    return `${parsed.aggregation} ${parsed.metric}`.trim()
  }
  return parsed.metric
}

/**
 * Maps stat type names (from API) to icon information.
 * Uses parsed metric for matching so unit variants (e.g. "Average Speed in Knots") still get the right icon.
 */
export function getStatIcon(statType: string): StatIcon | null {
  const parsed = parseStat(statType)
  const metric = parsed.metric
  const lower = metric.toLowerCase()

  if (lower === 'duration' || lower === 'time') {
    return { type: 'material', name: 'access_time' }
  }
  if (lower === 'moving time' || lower === 'movingtime') {
    return { type: 'svg', name: 'moving-time' }
  }
  if (lower === 'distance') {
    return { type: 'material', name: 'trending_flat' }
  }
  if (lower.includes('heart rate') || lower.includes('heartrate')) {
    return { type: 'svg', name: 'heart_pulse' }
  }
  if (lower === 'energy' || lower === 'calories' || lower.includes('calorie')) {
    return { type: 'svg', name: 'energy' }
  }
  if (lower.includes('speed')) {
    return { type: 'material', name: 'speed' }
  }
  if (lower.includes('cadence')) {
    return { type: 'material', name: 'cached' }
  }
  if (lower.includes('power')) {
    return { type: 'material', name: 'bolt' }
  }
  if (lower.includes('ascent')) {
    return { type: 'svg', name: 'arrow_up_right' }
  }
  if (lower.includes('descent')) {
    return { type: 'svg', name: 'arrow_down_right' }
  }
  if (lower.includes('altitude max') || lower.includes('max altitude')) {
    return { type: 'material', name: 'vertical_align_top' }
  }
  if (lower.includes('altitude min') || lower.includes('min altitude')) {
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
 * Uses parsed unit variant when present (e.g. "Kilometers per Hour" -> "km/h").
 */
export function getStatUnit(statType: string): string {
  const parsed = parseStat(statType)
  const lower = parsed.metric.toLowerCase()
  const variant = (parsed.unitVariant || '').toLowerCase()
  if (lower === 'duration' || lower === 'time' || lower === 'moving time' || lower === 'movingtime')
    return '' // time shown as e.g. "08:08" or "1:04:50", no unit suffix
  if (lower === 'distance') return 'm'
  if (lower.includes('heart rate') || lower.includes('heartrate')) return 'bpm'
  if (lower === 'energy' || lower.includes('calorie')) return 'kcal'
  if (lower.includes('speed')) {
    if (variant.includes('kilometer') || variant.includes('km')) return 'km/h'
    if (variant.includes('knot')) return 'kn'
    if (variant.includes('mile')) return 'mph'
    return 'm/s'
  }
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

/** Whether this stat type is a duration/time metric (value in seconds). */
export function isTimeStat(statType: string): boolean {
  const metric = parseStat(statType).metric.toLowerCase()
  return (
    metric === 'duration' ||
    metric === 'time' ||
    metric === 'moving time' ||
    metric === 'movingtime'
  )
}

/**
 * Formats a duration in seconds as human-readable time.
 * Examples: 488 -> "08:08", 3890 -> "1:04:50", 65 -> "01:05".
 */
export function formatDuration(seconds: number): string {
  const s = Math.floor(Number(seconds))
  if (!Number.isFinite(s) || s < 0) return String(seconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n: number) => n.toString().padStart(2, '0')
  if (h > 0) return `${h}:${pad(m)}:${pad(sec)}`
  return `${pad(m)}:${pad(sec)}`
}

/**
 * Formats a stat value for display.
 * When statType is provided and is a time stat, numeric values are shown as duration (e.g. "08:08", "1:04:50").
 * Handles numbers, strings, arrays, and objects.
 */
export function formatStatValue(
  value: number | string | number[] | Record<string, unknown> | undefined | null,
  statType?: string
): string {
  if (value == null) return ''
  if (statType && isTimeStat(statType)) {
    const n = typeof value === 'string' ? Number(value) : value
    if (typeof n === 'number' && Number.isFinite(n)) return formatDuration(n)
  }
  if (Array.isArray(value)) {
    return value.join(', ')
  }
  if (typeof value === 'object') {
    return JSON.stringify(value)
  }
  return String(value)
}

export interface StatEntry {
  statType: string
  value: string
  unit: string
}

/** One category of stats (e.g. "Speed", "Heart Rate") with its entries. */
export interface StatsByCategory {
  category: string
  entries: StatEntry[]
}

/**
 * Returns whether this stat should be kept after preferred-unit deduplication.
 * Only the preferred unit variant for each (metric + aggregation) is kept.
 */
function keepStatByPreferredUnit(parsed: ParsedStat): boolean {
  const preferred = PREFERRED_UNITS[parsed.metric]
  if (preferred === undefined) return true // unknown metric, keep
  if (preferred === null) return parsed.unitVariant === null
  return parsed.unitVariant === preferred
}

/**
 * Deduplicates by preferred unit and groups entries by metric family category.
 * Empty categories are omitted. Order of categories is stable (Time, Distance, Speed, …).
 */
const CATEGORY_ORDER = [
  'Time',
  'Distance',
  'Speed',
  'Heart Rate',
  'Cadence',
  'Power',
  'Elevation',
  'Energy',
  'Other',
]

export function getGroupedDeduplicatedStats(entries: StatEntry[]): StatsByCategory[] {
  const byCategory = new Map<string, StatEntry[]>()
  const seenKey = new Set<string>() // (metric + aggregation) to avoid duplicates

  for (const entry of entries) {
    const parsed = parseStat(entry.statType)
    if (!getStatIcon(entry.statType)) continue
    if (!keepStatByPreferredUnit(parsed)) continue

    const key = metricAggregationKey(parsed)
    if (seenKey.has(key)) continue
    seenKey.add(key)

    const category = getCategoryForMetric(parsed.metric)
    if (!byCategory.has(category)) {
      byCategory.set(category, [])
    }
    byCategory.get(category)!.push(entry)
  }

  const result: StatsByCategory[] = []
  for (const cat of CATEGORY_ORDER) {
    const list = byCategory.get(cat)
    if (list && list.length > 0) result.push({ category: cat, entries: list })
  }
  return result
}

/**
 * Picks key metrics for an activity type and returns matching stat entries in order.
 * Uses parsed metric/aggregation so "Average Speed in Kilometers per Hour" matches "Average Speed".
 */
export function selectKeyMetrics(
  stats: Record<string, unknown>,
  activityType: string
): StatEntry[] {
  const typeNorm = (activityType || '').toLowerCase().trim()
  let keys = KEY_METRICS.default
  if (typeNorm.includes('run')) keys = KEY_METRICS.running
  else if (typeNorm.includes('cycl') || typeNorm.includes('ride') || typeNorm.includes('bike'))
    keys = KEY_METRICS.cycling
  else if (typeNorm.includes('swim')) keys = KEY_METRICS.swimming

  const entries: StatEntry[] = []
  const statTypes = Object.keys(stats)
  for (const keyMetric of keys) {
    const keyNorm = keyMetric.toLowerCase()
    const found = statTypes.find((statType) => {
      const parsed = parseStat(statType)
      if (!keepStatByPreferredUnit(parsed)) return false
      const matchKey = metricAggregationKey(parsed)
      return matchKey.toLowerCase() === keyNorm
    })
    if (found) {
      const raw = stats[found]
      entries.push({
        statType: found,
        value: formatStatValue(raw, found),
        unit: getStatUnit(found),
      })
    }
  }
  return entries
}
