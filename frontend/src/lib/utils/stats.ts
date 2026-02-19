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
  const lower = trimmed.toLowerCase()
  const inIndex = lower.lastIndexOf(' in ')
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
export function metricAggregationKey(parsed: ParsedStat): string {
  if (parsed.aggregation) {
    return `${parsed.aggregation} ${parsed.metric}`.trim()
  }
  return parsed.metric
}

/**
 * Case-insensitive key for deduplication so "Average Pace" and "Average pace in minutes per mile"
 * (metric "Pace" vs "pace") collapse to one entry.
 */
export function metricAggregationKeyNormalized(parsed: ParsedStat): string {
  return metricAggregationKey(parsed).toLowerCase()
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
 * Gets a display unit for a stat type (e.g. "km/h", "bpm").
 * Time and distance use empty unit (value string includes the unit).
 */
export function getStatUnit(statType: string): string {
  const parsed = parseStat(statType)
  const lower = parsed.metric.toLowerCase()
  if (lower === 'duration' || lower === 'time' || lower === 'moving time' || lower === 'movingtime')
    return '' // time shown as "08:08" or "1:04:50"
  if (lower === 'distance') return '' // distance shown as "1.69km" or "789m"
  if (lower.includes('heart rate') || lower.includes('heartrate')) return 'bpm'
  if (lower === 'energy' || lower.includes('calorie')) return 'kcal'
  if (lower.includes('speed')) return 'km/h' // always metric
  if (lower.includes('cadence')) return 'rpm'
  if (lower.includes('power')) return 'W'
  if (lower.includes('ascent') || lower.includes('descent') || lower.includes('altitude'))
    return 'm'
  return ''
}

/**
 * Gets a display label for a stat type (aggregation + metric only, no unit variant).
 * e.g. "Average Speed in Feet per Minute" -> "Average Speed".
 */
export function getStatLabel(statType: string): string {
  const parsed = parseStat(statType)
  const part = parsed.aggregation ? `${parsed.aggregation} ${parsed.metric}` : parsed.metric
  return part
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

/** Whether this stat type is a distance metric (value in meters). */
export function isDistanceStat(statType: string): boolean {
  return parseStat(statType).metric.toLowerCase() === 'distance'
}

/** Whether this stat type is a speed metric. */
export function isSpeedStat(statType: string): boolean {
  return parseStat(statType).metric.toLowerCase().includes('speed')
}

/** Multipliers to convert speed value to km/h (value * factor = km/h). */
const SPEED_TO_KMH: Record<string, number> = {
  'kilometers per hour': 1,
  'km/h': 1,
  'meters per second': 3.6,
  'm/s': 3.6,
  'miles per hour': 1.60934,
  'mph': 1.60934,
  'feet per minute': 0.018288,
  'feet per second': 1.09728,
  knots: 1.852,
  knot: 1.852, // API sometimes uses singular
  'meters per minute': 0.06,
}

function speedToKmh(value: number, unitVariant: string | null): number {
  if (value == null || !Number.isFinite(value)) return value
  // sports-lib base "Average Speed" (no "in X") is in m/s
  if (!unitVariant) return value * 3.6
  const key = unitVariant.toLowerCase()
  const factor = SPEED_TO_KMH[key]
  if (factor != null) return value * factor
  return value * 3.6 // unknown variant, assume m/s
}

/** Rounds a number to 2 decimal places and returns a string (no trailing .00 for integers). */
export function roundTo2Decimals(n: number): string {
  if (!Number.isFinite(n)) return String(n)
  const r = Math.round(n * 100) / 100
  return Number.isInteger(r) ? String(r) : r.toFixed(2)
}

/**
 * Checks if a value is a coordinate-like object (latitude/longitude) and formats it for display.
 * Handles both { latitudeDegrees, longitudeDegrees } and { latitude, longitude }.
 * Returns null if not a coordinate object.
 */
function formatCoordinateValue(
  value: Record<string, unknown> | string
): string | null {
  let lat: number | undefined
  let lon: number | undefined

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as Record<string, unknown>
      lat = Number(parsed.latitudeDegrees ?? parsed.latitude)
      lon = Number(parsed.longitudeDegrees ?? parsed.longitude)
    } catch {
      return null
    }
  } else if (value && typeof value === 'object') {
    lat = Number((value as Record<string, unknown>).latitudeDegrees ?? (value as Record<string, unknown>).latitude)
    lon = Number((value as Record<string, unknown>).longitudeDegrees ?? (value as Record<string, unknown>).longitude)
  } else {
    return null
  }

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null

  const latStr = Math.abs(lat).toFixed(6) + (lat >= 0 ? '°N' : '°S')
  const lonStr = Math.abs(lon).toFixed(6) + (lon >= 0 ? '°E' : '°W')
  return `${latStr}, ${lonStr}`
}

/**
 * Formats distance in meters as human-friendly metric string.
 * Examples: 654 -> "654m", 1690 -> "1.69km", 1000 -> "1.00km".
 */
export function formatDistance(meters: number): string {
  const m = Number(meters)
  if (!Number.isFinite(m) || m < 0) return String(meters)
  if (m >= 1000) {
    const km = m / 1000
    return km % 1 === 0 ? `${km}km` : `${km.toFixed(2)}km`
  }
  return `${Math.round(m)}m`
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
 * - Time stats: duration (e.g. "08:08", "1:04:50").
 * - Distance: human-friendly metric (e.g. "789m", "1.69km").
 * - Speed: always km/h (converts from other units if needed).
 */
export function formatStatValue(
  value: number | string | number[] | Record<string, unknown> | undefined | null,
  statType?: string
): string {
  if (value == null) return ''
  if (statType) {
    const n = typeof value === 'string' ? Number(value) : value
    if (typeof n === 'number' && Number.isFinite(n)) {
      if (isTimeStat(statType)) return formatDuration(n)
      if (isDistanceStat(statType)) return formatDistance(n)
      if (isSpeedStat(statType)) {
        const parsed = parseStat(statType)
        const kmh = speedToKmh(n, parsed.unitVariant)
        return typeof kmh === 'number' && Number.isFinite(kmh) ? roundTo2Decimals(kmh) : String(value)
      }
    }
  }
  if (Array.isArray(value)) {
    return value.map((v) => (typeof v === 'number' && Number.isFinite(v) ? roundTo2Decimals(v) : String(v))).join(', ')
  }
  if (typeof value === 'object' && value !== null) {
    const coord = formatCoordinateValue(value as Record<string, unknown>)
    if (coord) return coord
    return JSON.stringify(value)
  }
  if (typeof value === 'string') {
    const coord = formatCoordinateValue(value)
    if (coord) return coord
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return roundTo2Decimals(value)
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
 * 
 * General rule: For any metric, prefer the version without a unit variant.
 * If a base version exists (no "in WORD per WORD"), discard all unit-specific variants.
 * If no base version exists, use PREFERRED_UNITS to select the preferred unit variant.
 */
export function keepStatByPreferredUnit(parsed: ParsedStat): boolean {
  // Base version (no unit variant) is always preferred
  if (parsed.unitVariant === null) {
    return true
  }
  
  // If there's a unit variant, check if it matches the preferred unit for this metric
  const preferred = PREFERRED_UNITS[parsed.metric]
  if (preferred === undefined) {
    // Unknown metric: prefer base versions, discard unit variants
    // (base version would have been caught above, so this is a unit variant - discard it)
    return false
  }
  if (preferred === null) {
    // Metric prefers no unit variant, but this has one - discard it
    return false
  }
  // Metric has a preferred unit variant - only keep if this matches
  return parsed.unitVariant.toLowerCase() === preferred.toLowerCase()
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

  // Sort: base versions (no unit variant) first, then preferred unit variants, then others
  const sorted = [...entries].sort((a, b) => {
    const pa = parseStat(a.statType)
    const pb = parseStat(b.statType)
    const aIsBase = pa.unitVariant === null
    const bIsBase = pb.unitVariant === null
    
    // Base versions always come first
    if (aIsBase && !bIsBase) return -1
    if (!aIsBase && bIsBase) return 1
    
    // Then preferred variants
    const aPreferred = keepStatByPreferredUnit(pa)
    const bPreferred = keepStatByPreferredUnit(pb)
    return (bPreferred ? 1 : 0) - (aPreferred ? 1 : 0)
  })

  for (const entry of sorted) {
    const parsed = parseStat(entry.statType)
    if (!getStatIcon(entry.statType)) continue
    const key = metricAggregationKeyNormalized(parsed) // case-insensitive so base and "in X per Y" variants collapse
    
    // Skip if we've already seen this key (base/preferred version was processed first)
    if (seenKey.has(key)) continue
    
    // Only keep preferred variants (base versions are always preferred)
    const preferred = keepStatByPreferredUnit(parsed)
    if (!preferred) continue
    
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
 * Finds the first stat in stats whose parsed metric (and optional aggregation) matches.
 * Returns { statType, value } for use with formatStatValue(value, statType), or null if not found.
 */
export function findStatByMetric(
  stats: Record<string, unknown>,
  metric: string,
  aggregation?: string | null
): { statType: string; value: unknown } | null {
  const metricNorm = metric.toLowerCase().trim()
  for (const statType of Object.keys(stats)) {
    const parsed = parseStat(statType)
    if (parsed.metric.toLowerCase().trim() !== metricNorm) continue
    if (
      aggregation !== undefined &&
      (parsed.aggregation?.toLowerCase().trim() ?? null) !== (aggregation?.toLowerCase().trim() ?? null)
    )
      continue
    return { statType, value: stats[statType] }
  }
  return null
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
    const isSpeedKey = keyNorm.includes('speed')
    // Prefer preferred-unit variant; for speed, accept any variant (value converted to km/h at display)
    let found = statTypes.find((statType) => {
      const parsed = parseStat(statType)
      if (!keepStatByPreferredUnit(parsed)) {
        if (!isSpeedKey || !parsed.metric.toLowerCase().includes('speed')) return false
      }
      return metricAggregationKey(parsed).toLowerCase() === keyNorm
    })
    if (isSpeedKey) {
      const preferred = statTypes.find(
        (statType) =>
          keepStatByPreferredUnit(parseStat(statType)) &&
          metricAggregationKey(parseStat(statType)).toLowerCase() === keyNorm
      )
      if (preferred) found = preferred
    }
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
