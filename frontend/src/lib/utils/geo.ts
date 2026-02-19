import type { StreamData } from '../types'

export interface RouteGeoJSON {
  type: 'Feature'
  geometry: { type: 'LineString'; coordinates: [number, number][] }
  properties: Record<string, never>
}

export interface RouteBounds {
  minLng: number
  maxLng: number
  minLat: number
  maxLat: number
}

function isValidNum(n: unknown): n is number {
  return typeof n === 'number' && !Number.isNaN(n) && Number.isFinite(n)
}

/** Minimum span in degrees so bounds are never degenerate (avoids null in MapLibre camera) */
const MIN_BOUNDS_SPAN = 0.0002

function coordsToBounds(coords: [number, number][]): RouteBounds {
  const lngs = coords.map((c) => c[0])
  const lats = coords.map((c) => c[1])
  let minLng = Math.min(...lngs)
  let maxLng = Math.max(...lngs)
  let minLat = Math.min(...lats)
  let maxLat = Math.max(...lats)
  if (maxLng - minLng < MIN_BOUNDS_SPAN) {
    const pad = MIN_BOUNDS_SPAN / 2
    minLng -= pad
    maxLng += pad
  }
  if (maxLat - minLat < MIN_BOUNDS_SPAN) {
    const pad = MIN_BOUNDS_SPAN / 2
    minLat -= pad
    maxLat += pad
  }
  return { minLng, maxLng, minLat, maxLat }
}

/**
 * Build a GeoJSON LineString and bounds from activity stream data.
 * Handles separate Latitude/Longitude streams (zip by timestamp) or a single Position stream.
 * Returns null if no valid location data. Coordinates are [lng, lat] per GeoJSON spec.
 */
export function buildRouteGeoJSON(
  streams: StreamData[]
): { route: RouteGeoJSON; bounds: RouteBounds } | null {
  const positionStream = streams.find((s) => s.type === 'Position')
  if (positionStream?.data?.length) {
    const coords: [number, number][] = []
    for (const p of positionStream.data) {
      const v = p.value
      if (v && typeof v === 'object' && 'latitude' in v && 'longitude' in v) {
        const lat = (v as { latitude: unknown }).latitude
        const lng = (v as { longitude: unknown }).longitude
        if (isValidNum(lat) && isValidNum(lng)) {
          coords.push([lng, lat])
        }
      }
    }
    if (coords.length >= 2) {
      return {
        route: {
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: coords },
          properties: {},
        },
        bounds: coordsToBounds(coords),
      }
    }
  }

  const latStream = streams.find((s) => s.type === 'Latitude')
  const lngStream = streams.find((s) => s.type === 'Longitude')
  if (!latStream?.data?.length || !lngStream?.data?.length) {
    return null
  }

  const timeToLat = new Map<number, number>()
  for (const p of latStream.data) {
    if (isValidNum(p.value)) {
      timeToLat.set(p.time, p.value)
    }
  }
  const timeToLng = new Map<number, number>()
  for (const p of lngStream.data) {
    if (isValidNum(p.value)) {
      timeToLng.set(p.time, p.value)
    }
  }

  const times = [...new Set([...timeToLat.keys(), ...timeToLng.keys()])].filter(
    (t) => timeToLat.has(t) && timeToLng.has(t)
  )
  if (times.length < 2) {
    return null
  }
  times.sort((a, b) => a - b)

  const coords: [number, number][] = times.map((t) => [
    timeToLng.get(t)!,
    timeToLat.get(t)!,
  ])
  return {
    route: {
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: coords },
      properties: {},
    },
    bounds: coordsToBounds(coords),
  }
}
