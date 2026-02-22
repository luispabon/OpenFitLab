import { findStatByMetric } from './stat-categories'
import { formatStatValue } from './stat-formatting'

type StatValue = number | string | number[] | Record<string, unknown> | null | undefined

export function formatDurationCell(stats: Record<string, unknown>): string {
  const found = findStatByMetric(stats, 'Duration') ?? findStatByMetric(stats, 'Moving Time')
  if (!found) return '—'
  return formatStatValue(found.value as StatValue, found.statType)
}

export function formatAvgHeartRateCell(stats: Record<string, unknown>): string {
  const found = findStatByMetric(stats, 'Heart Rate', 'Average')
  if (!found) return '—'
  return formatStatValue(found.value as StatValue, found.statType)
}

export function formatCaloriesCell(stats: Record<string, unknown>): string {
  const found = findStatByMetric(stats, 'Energy') ?? findStatByMetric(stats, 'Calories')
  if (!found) return '—'
  return formatStatValue(found.value as StatValue, found.statType)
}

export function formatDistanceCell(stats: Record<string, unknown>): string {
  const found = findStatByMetric(stats, 'Distance')
  if (!found) return '—'
  return formatStatValue(found.value as StatValue, found.statType)
}
