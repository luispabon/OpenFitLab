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

  type MapTheme = 'dark' | 'positron' | 'bright' | 'liberty' | 'fiord'

  const THEME_OPTIONS: Array<{ value: MapTheme; label: string }> = [
    { value: 'dark', label: 'Dark' },
    { value: 'positron', label: 'Positron' },
    { value: 'bright', label: 'Bright' },
    { value: 'liberty', label: 'Liberty' },
    { value: 'fiord', label: 'Fiord' },
  ]

  interface Props {
    streams: StreamData[]
  }
  let { streams }: Props = $props()

  let selectedTheme = $state<MapTheme>('liberty')
  let showLabels = $state(true)
  let map = $state<MapLibreMap | undefined>(undefined)

  const mapStyle = $derived(`https://tiles.openfreemap.org/styles/${selectedTheme}`)

  function toggleLabels() {
    showLabels = !showLabels
  }

  $effect(() => {
    if (!map) return
    const labelsVisible = showLabels

    const updateLabels = () => {
      if (!map || !map.isStyleLoaded()) return
      const visibility = labelsVisible ? 'visible' : 'none'
      const style = map.getStyle()
      if (!style || !style.layers) return

      for (const layer of style.layers) {
        if (layer.type === 'symbol' && layer.layout) {
          map.setLayoutProperty(layer.id, 'visibility', visibility)
        }
      }
    }

    if (map.isStyleLoaded()) {
      updateLabels()
    }

    const handler = () => updateLabels()
    map.on('style.load', handler)

    return () => {
      map.off('style.load', handler)
    }
  })

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
  <div class="relative">
    <div class="absolute top-2 left-2 z-10 flex gap-2">
      <div class="rounded-lg border border-border bg-card shadow-sm">
        <select
          bind:value={selectedTheme}
          class="rounded-lg border-0 bg-transparent px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
        >
          {#each THEME_OPTIONS as option}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
      </div>
      <button
        type="button"
        onclick={toggleLabels}
        class="rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-text-primary shadow-sm transition-colors hover:bg-card-hover focus:outline-none focus:ring-2 focus:ring-accent"
        title={showLabels ? 'Hide labels' : 'Show labels'}
      >
        <span class="material-icons text-base">{showLabels ? 'label' : 'label_off'}</span>
      </button>
    </div>
    <div class="h-[600px] w-full overflow-hidden rounded-xl border border-border">
      <MapLibre
        bind:map
        class="h-full w-full"
        style={mapStyle}
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
  </div>
{/if}
