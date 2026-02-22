import { parseStat } from './stat-parsing'

export interface StatIcon {
  type: 'material' | 'svg'
  name: string
}

/** Material Icons name for display (maps custom SVG names to Material equivalents). */
const SVG_TO_MATERIAL: Record<string, string> = {
  'moving-time': 'schedule',
  heart_pulse: 'favorite',
  energy: 'local_fire_department',
  arrow_up_right: 'trending_up',
  arrow_down_right: 'trending_down',
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
