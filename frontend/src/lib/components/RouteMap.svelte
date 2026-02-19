<script lang="ts">
  import { MapLibre } from 'svelte-maplibre-gl'
  import type { Map as MapLibreMap } from 'maplibre-gl'
  import 'maplibre-gl/dist/maplibre-gl.css'
  import type { StreamData } from '../types'
  import { buildRouteGeoJSON } from '../utils/geo'

  const OSM_SOURCE = {
    type: 'raster' as const,
    tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
    tileSize: 256,
    attribution: '© OpenStreetMap contributors',
  }

  interface Props {
    streams: StreamData[]
  }
  let { streams }: Props = $props()

  const routeData = $derived(buildRouteGeoJSON(streams))

  const center = $derived.by(() => {
    if (!routeData) return undefined
    const { minLng, maxLng, minLat, maxLat } = routeData.bounds
    return [(minLng + maxLng) / 2, (minLat + maxLat) / 2] as [number, number]
  })

  const boundsForFit = $derived.by(() => {
    if (!routeData) return null
    const { minLng, minLat, maxLng, maxLat } = routeData.bounds
    if (!Number.isFinite(minLng + maxLng + minLat + maxLat)) return null
    return [[minLng, minLat], [maxLng, maxLat]] as [[number, number], [number, number]]
  })

  const mapStyle = $derived.by(() => {
    if (!routeData) return null
    return {
      version: 8 as const,
      sources: {
        osm: OSM_SOURCE,
        'route-source': { type: 'geojson' as const, data: routeData.route },
      },
      layers: [
        { id: 'osm', type: 'raster' as const, source: 'osm', minzoom: 0, maxzoom: 19 },
        {
          id: 'route-layer',
          type: 'line' as const,
          source: 'route-source',
          paint: { 'line-color': '#3b82f6', 'line-width': 3 },
          layout: { 'line-join': 'round', 'line-cap': 'round' },
        },
      ],
    }
  })

  function onMapLoad(ev: { target: MapLibreMap }) {
    const m = ev.target
    if (boundsForFit) {
      m.fitBounds(boundsForFit, { padding: 40, maxZoom: 16 })
    }
  }
</script>

{#if routeData && center && mapStyle}
  <div class="h-[400px] w-full overflow-hidden rounded-xl border border-border">
    <MapLibre
      class="h-full w-full"
      style={mapStyle}
      center={center}
      zoom={12}
      onload={onMapLoad}
      autoloadGlobalCss={false}
      canvasContextAttributes={{ preserveDrawingBuffer: true }}
    />
  </div>
{/if}
