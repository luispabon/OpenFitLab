/**
 * Maps activity type strings to Material icon names or custom icon identifiers.
 * Based on activity type groups from sports-lib, but simplified for string matching.
 */
export function getActivityIcon(activityType: string | undefined | null): string {
  if (!activityType) return 'category'

  // Handle comma-separated activity types (take first)
  const activities = activityType.split(',').map((a) => a.trim())
  const activity = activities[0]

  // Special cases first
  if (activity === 'Virtual Cycling' || activity === 'VirtualRide') {
    return 'computer'
  }
  if (activity === 'Virtual Running' || activity === 'VirtualRun') {
    return 'computer'
  }

  // Map common activity types to icons
  const lower = activity.toLowerCase()

  // Running
  if (lower.includes('run') || lower === 'running' || lower === 'trail running') {
    return 'directions_run'
  }

  // Cycling
  if (
    lower.includes('cycl') ||
    lower === 'cycling' ||
    lower === 'bike' ||
    lower === 'biking' ||
    lower === 'road cycling' ||
    lower === 'mountain biking'
  ) {
    return 'directions_bike'
  }

  // Swimming
  if (lower.includes('swim') || lower === 'swimming') {
    return 'pool'
  }

  // Indoor sports / gym
  if (
    lower.includes('weight') ||
    lower.includes('strength') ||
    lower.includes('gym') ||
    lower.includes('indoor')
  ) {
    return 'fitness_center'
  }

  // Hiking / outdoor
  if (lower.includes('hike') || lower.includes('walk') || lower.includes('outdoor')) {
    return 'hiking'
  }

  // Winter sports
  if (lower.includes('ski') || lower.includes('snow') || lower.includes('winter')) {
    return 'ac_unit'
  }

  // Water sports
  if (lower.includes('row') || lower.includes('kayak') || lower.includes('water')) {
    return 'rowing'
  }

  // Diving
  if (lower.includes('div')) {
    return 'scuba_diving'
  }

  // Tennis / racket sports
  if (lower.includes('tennis') || lower.includes('racket') || lower.includes('badminton')) {
    return 'sports_tennis'
  }

  // Performance / competition
  if (lower.includes('competition') || lower.includes('race') || lower.includes('performance')) {
    return 'workspace_premium'
  }

  // Default
  return 'category'
}
