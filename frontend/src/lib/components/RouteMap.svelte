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
  import { buildRouteGeoJSON, mergeBounds } from '../utils/geo'

  export interface NamedRoute {
    label: string
    color: string
    streams: StreamData[]
  }

  type MapTheme = 'dark' | 'positron' | 'bright' | 'liberty' | 'fiord'

  const THEME_OPTIONS: Array<{ value: MapTheme; label: string }> = [
    { value: 'dark', label: 'Dark' },
    { value: 'positron', label: 'Positron' },
    { value: 'bright', label: 'Bright' },
    { value: 'liberty', label: 'Liberty' },
    { value: 'fiord', label: 'Fiord' },
  ]

  interface Props {
    streams?: StreamData[]
    routes?: NamedRoute[]
  }
  let { streams = [], routes }: Props = $props()

  let selectedTheme = $state<MapTheme>('liberty')
  let showLabels = $state(true)
  let map = $state<MapLibreMap | undefined>(undefined)

  const mapStyle = $derived(`https://tiles.openfreemap.org/styles/${selectedTheme}`)

  $effect(() => {
    const m = map
    if (!m) return
    const labelsVisible = showLabels

    const updateLabels = () => {
      if (!m.isStyleLoaded()) return
      const visibility = labelsVisible ? 'visible' : 'none'
      for (const layer of m.getStyle()?.layers ?? []) {
        if (layer.type === 'symbol') {
          m.setLayoutProperty(layer.id, 'visibility', visibility)
        }
      }
    }

    if (m.isStyleLoaded()) {
      updateLabels()
    }
    m.on('style.load', updateLabels)
    return () => m.off('style.load', updateLabels)
  })

  /** Single-route: one item with route + bounds. Multi-route: one item per route with color + label, merged bounds. */
  const routesWithData = $derived.by(() => {
    if (routes?.length) {
      const items: Array<{ route: ReturnType<typeof buildRouteGeoJSON>; color: string; label: string }> = []
      for (const r of routes) {
        const data = buildRouteGeoJSON(r.streams)
        if (data) items.push({ route: data, color: r.color, label: r.label })
      }
      return items
    }
    const single = buildRouteGeoJSON(streams)
    if (single) return [{ route: single, color: '#60a5fa', label: '' }]
    return []
  })

  const showLegend = $derived(Boolean(routes?.length && routesWithData.length > 0))

  const mergedBounds = $derived.by(() => {
    if (routesWithData.length === 0) return null
    return mergeBounds(routesWithData.map((r) => r.route.bounds))
  })

  const center = $derived.by(() => {
    if (!mergedBounds) return undefined
    const { minLng, maxLng, minLat, maxLat } = mergedBounds
    return [(minLng + maxLng) / 2, (minLat + maxLat) / 2] as [number, number]
  })

  const boundsForFit = $derived(
    mergedBounds
      ? ([[mergedBounds.minLng, mergedBounds.minLat], [mergedBounds.maxLng, mergedBounds.maxLat]] as [
          [number, number],
          [number, number],
        ])
      : null
  )

  function handleLoad(ev: { target: MapLibreMap }) {
    if (!boundsForFit) return
    try {
      ev.target.fitBounds(boundsForFit, { padding: 40, maxZoom: 16 })
    } catch {
      // ignore
    }
  }
</script>

{#if routesWithData.length > 0 && center}
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
        onclick={() => (showLabels = !showLabels)}
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
        {#each routesWithData as item, i}
          {@const sourceId = `route-source-${i}`}
          {@const layerId = `route-layer-${i}`}
          <GeoJSONSource data={item.route.route} id={sourceId}>
            <LineLayer
              id={layerId}
              paint={{ 'line-color': item.color, 'line-width': 4 }}
              layout={{ 'line-join': 'round', 'line-cap': 'round' }}
            />
          </GeoJSONSource>
        {/each}
      </MapLibre>
    </div>
    {#if showLegend}
      <div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-text-secondary">
        {#each routesWithData as item}
          <div class="flex items-center gap-2">
            <span
              class="h-3 w-3 shrink-0 rounded-sm"
              style="background-color: {item.color};"
              aria-hidden="true"
            ></span>
            <span class="text-text-primary">{item.label}:</span>
          </div>
        {/each}
      </div>
    {/if}
  </div>
{/if}
