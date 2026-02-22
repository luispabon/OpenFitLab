import type { ParsedStat } from './stat-parsing'
import { parseStat } from './stat-parsing'
import { getStatIcon, getStatUnit } from './stat-icons'
import { formatStatValue } from './stat-formatting'

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
export function keepStatByPreferredUnit(parsed: ParsedStat): boolean {
  if (parsed.unitVariant === null) {
    return true
  }
  const preferred = PREFERRED_UNITS[parsed.metric]
  if (preferred === undefined) {
    return false
  }
  if (preferred === null) {
    return false
  }
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
  const seenKey = new Set<string>()

  const sorted = [...entries].sort((a, b) => {
    const pa = parseStat(a.statType)
    const pb = parseStat(b.statType)
    const aIsBase = pa.unitVariant === null
    const bIsBase = pb.unitVariant === null
    if (aIsBase && !bIsBase) return -1
    if (!aIsBase && bIsBase) return 1
    const aPreferred = keepStatByPreferredUnit(pa)
    const bPreferred = keepStatByPreferredUnit(pb)
    return (bPreferred ? 1 : 0) - (aPreferred ? 1 : 0)
  })

  for (const entry of sorted) {
    const parsed = parseStat(entry.statType)
    if (!getStatIcon(entry.statType)) continue
    const key = metricAggregationKeyNormalized(parsed)
    if (seenKey.has(key)) continue
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
      const raw = stats[found] as number | string | number[] | Record<string, unknown> | null | undefined
      entries.push({
        statType: found,
        value: formatStatValue(raw, found),
        unit: getStatUnit(found),
      })
    }
  }
  return entries
}
