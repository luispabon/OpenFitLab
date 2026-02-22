/** Parsed stat (sports-lib naming: [Aggregation] Metric [in UnitVariant]) */
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
