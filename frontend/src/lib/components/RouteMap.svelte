<script lang="ts">
  import {
    MapLibre,
    GeoJSONSource,
    LineLayer,
    NavigationControl,
    FullScreenControl,
  } from 'svelte-maplibre-gl'
  import type { Map as MapLibreMap } from 'maplibre-gl'
  import 'maplibre-gl/dist/maplibre-gl.css'
  import type { StreamData } from '../types'
  import { buildRouteGeoJSON } from '../utils/geo'

  const MAP_STYLE = 'https://tiles.openfreemap.org/styles/fiord'

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
      <NavigationControl position="top-right" />
      <FullScreenControl position="top-right" />
      <GeoJSONSource data={routeData.route}>
        <LineLayer
          paint={{ 'line-color': '#60a5fa', 'line-width': 4 }}
          layout={{ 'line-join': 'round', 'line-cap': 'round' }}
        />
      </GeoJSONSource>
    </MapLibre>
  </div>
{/if}
