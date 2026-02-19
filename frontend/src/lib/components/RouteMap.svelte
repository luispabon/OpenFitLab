<script lang="ts">
  import { MapLibre, GeoJSONSource, LineLayer } from 'svelte-maplibre-gl'
  import 'maplibre-gl/dist/maplibre-gl.css'
  import type { StreamData } from '../types'
  import { buildRouteGeoJSON } from '../utils/geo'

  interface Props {
    streams: StreamData[]
  }
  let { streams }: Props = $props()

  const routeData = $derived(buildRouteGeoJSON(streams))

  const bounds = $derived(
    routeData
      ? [
          [routeData.bounds.minLng, routeData.bounds.minLat] as [number, number],
          [routeData.bounds.maxLng, routeData.bounds.maxLat] as [number, number],
        ]
      : undefined
  )
</script>

{#if routeData && bounds}
  <div class="h-[400px] w-full overflow-hidden rounded-xl border border-border">
    <MapLibre
      class="h-full w-full"
      style="https://tiles.openfreemap.org/styles/positron"
      {bounds}
      fitBoundsOptions={{ padding: 40 }}
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
