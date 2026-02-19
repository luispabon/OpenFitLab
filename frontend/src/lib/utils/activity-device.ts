import type { Activity } from '../types/event'

/**
 * Extracts the device name from an activity.
 * Checks in order:
 * 1. Activity stats for 'Device Names' array (first element)
 * 2. Activity creator name
 * 3. Activity creator devices array (first device name)
 * 4. Falls back to '—' if none found
 */
export function getActivityDeviceName(
  activity:
    | Activity
    | {
        creator?: { name?: string; devices?: Array<{ name?: string }> }
        stats?: Record<string, unknown>
        [key: string]: unknown
      }
): string {
  const stats = activity.stats as Record<string, unknown> | undefined
  const deviceNames = stats?.['Device Names']
  if (Array.isArray(deviceNames) && deviceNames.length > 0) {
    const first = deviceNames[0]
    if (typeof first === 'string') return first
    if (
      first &&
      typeof first === 'object' &&
      'name' in first &&
      typeof (first as { name: string }).name === 'string'
    ) {
      return (first as { name: string }).name
    }
  }
  const creator = activity.creator as
    | { name?: string; devices?: Array<{ name?: string }> }
    | undefined
  if (creator?.name && typeof creator.name === 'string') return creator.name
  const firstDevice = Array.isArray(creator?.devices) ? creator.devices[0] : undefined
  return firstDevice?.name ?? '—'
}
