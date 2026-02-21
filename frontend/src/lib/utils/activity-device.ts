import type { Activity } from '../types/event'

/**
 * Returns the device name for an activity (from the device_name column).
 */
export function getActivityDeviceName(activity: Activity | { deviceName?: string }): string {
  return activity.deviceName || '—'
}
