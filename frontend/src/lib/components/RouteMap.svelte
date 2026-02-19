<script lang="ts">
  import { MapLibre, GeoJSONSource, LineLayer } from 'svelte-maplibre-gl'
  import type { Map as MapLibreMap } from 'maplibre-gl'
  import 'maplibre-gl/dist/maplibre-gl.css'
  import type { StreamData } from '../types'
  import { buildRouteGeoJSON } from '../utils/geo'

  /** Minimal inline style (no remote style = no "number, found null" from style expressions). */
  const MAP_STYLE = {
    version: 8,
    sources: {
      osm: {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '© OpenStreetMap contributors',
      },
    },
    layers: [
      {
        id: 'osm',
        type: 'raster',
        source: 'osm',
        minzoom: 0,
        maxzoom: 19,
      },
    ],
  } as const

  interface Props {
    streams: StreamData[]
  }
  let { streams }: Props = $props()

  const routeData = $derived(buildRouteGeoJSON(streams))

  const center = $derived.by(() => {
    if (!routeData) return undefined
    const { minLng, maxLng, minLat, maxLat } = routeData.bounds
    return [((minLng + maxLng) / 2) as number, ((minLat + maxLat) / 2) as number] as [
      number,
      number,
    ]
  })

  const boundsForFit = $derived(
    routeData
      ? ([[routeData.bounds.minLng, routeData.bounds.minLat], [routeData.bounds.maxLng, routeData.bounds.maxLat]] as [
          [number, number],
          [number, number],
        ])
      : null
  )

  function handleLoad(ev: { target: MapLibreMap }) {
    const map = ev.target
    if (!boundsForFit || !map) return
    const [[minLng, minLat], [maxLng, maxLat]] = boundsForFit
    if (
      typeof minLng !== 'number' ||
      typeof maxLng !== 'number' ||
      typeof minLat !== 'number' ||
      typeof maxLat !== 'number' ||
      !Number.isFinite(minLng + maxLng + minLat + maxLat)
    ) {
      return
    }
    try {
      map.fitBounds(boundsForFit, { padding: 40, maxZoom: 16 })
    } catch {
      // ignore if fitBounds fails
    }
  }
</script>

{#if routeData && center}
  <div class="h-[600px] w-full overflow-hidden rounded-xl border border-border">
    <MapLibre
      class="h-full w-full"
      style={MAP_STYLE}
      center={center}
      zoom={12}
      onload={handleLoad}
      autoloadGlobalCss={false}
    >
      <GeoJSONSource data={routeData.route}>
        <LineLayer
          paint={{ 'line-color': '#3b82f6', 'line-width': 3 }}
          layout={{ 'line-join': 'round', 'line-cap': 'round' }}
        />
      </GeoJSONSource>
    </MapLibre>
  </div>
{/if}
