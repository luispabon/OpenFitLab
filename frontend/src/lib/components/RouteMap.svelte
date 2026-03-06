<script lang="ts">
  import {
    MapLibre,
    GeoJSONSource,
    LineLayer,
    SymbolLayer,
    NavigationControl,
    FullScreenControl,
    CustomControl,
  } from 'svelte-maplibre-gl';
  import type { Map as MapLibreMap } from 'maplibre-gl';
  import 'maplibre-gl/dist/maplibre-gl.css';
  import type { StreamData } from '../types';
  import { buildRouteGeoJSON, mergeBounds } from '../utils/geo';

  const ROUTE_ARROW_IMAGE_ID = 'route-direction-arrow';
  const ROUTE_ARROW_LAYER_PREFIX = 'route-arrow-';

  /** Right-pointing solid triangle (24×24), white so SDF tint (icon-color) applies */
  const ARROW_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="#ffffff" d="M6 6L6 18L20 12Z"/></svg>';

  export interface NamedRoute {
    label: string;
    color: string;
    streams: StreamData[];
  }

  type MapTheme = 'dark' | 'positron' | 'bright' | 'liberty' | 'fiord';

  const THEME_OPTIONS: Array<{ value: MapTheme; label: string }> = [
    { value: 'dark', label: 'Dark' },
    { value: 'positron', label: 'Positron' },
    { value: 'bright', label: 'Bright' },
    { value: 'liberty', label: 'Liberty' },
    { value: 'fiord', label: 'Fiord' },
  ];

  interface Props {
    streams?: StreamData[];
    routes?: NamedRoute[];
  }
  let { streams = [], routes }: Props = $props();

  let selectedTheme = $state<MapTheme>('liberty');
  let showLabels = $state(true);
  let map = $state<MapLibreMap | undefined>(undefined);
  let arrowImageLoaded = $state<HTMLImageElement | null>(null);

  const mapStyle = $derived(`https://tiles.openfreemap.org/styles/${selectedTheme}`);

  /** Preload arrow image when map is available (used when adding to style on style.load). */
  $effect(() => {
    if (!map) return;
    const img = new Image();
    img.onload = () => {
      arrowImageLoaded = img;
    };
    img.src = 'data:image/svg+xml,' + encodeURIComponent(ARROW_SVG);
  });

  /** Add arrow image to map style on every style load (required after theme change). */
  $effect(() => {
    const m = map;
    const img = arrowImageLoaded;
    if (!m || !img) return;
    const addArrowImage = () => {
      try {
        m.addImage(ROUTE_ARROW_IMAGE_ID, img, { pixelRatio: 2, sdf: true });
      } catch {
        // ignore if style not ready or image already exists
      }
    };
    if (m.isStyleLoaded()) addArrowImage();
    m.on('style.load', addArrowImage);
    return () => m.off('style.load', addArrowImage);
  });

  $effect(() => {
    const m = map;
    if (!m) return;
    const labelsVisible = showLabels;

    const updateLabels = () => {
      if (!m.isStyleLoaded()) return;
      const visibility = labelsVisible ? 'visible' : 'none';
      for (const layer of m.getStyle()?.layers ?? []) {
        if (layer.type === 'symbol' && !layer.id.startsWith(ROUTE_ARROW_LAYER_PREFIX)) {
          m.setLayoutProperty(layer.id, 'visibility', visibility);
        }
      }
    };

    if (m.isStyleLoaded()) {
      updateLabels();
    }
    m.on('style.load', updateLabels);
    return () => m.off('style.load', updateLabels);
  });

  /** Single-route: one item with route + bounds. Multi-route: one item per route with color + label, merged bounds. */
  const routesWithData = $derived.by(() => {
    if (routes?.length) {
      const items: Array<{
        route: ReturnType<typeof buildRouteGeoJSON>;
        color: string;
        label: string;
      }> = [];
      for (const r of routes) {
        const data = buildRouteGeoJSON(r.streams);
        if (data) items.push({ route: data, color: r.color, label: r.label });
      }
      return items;
    }
    const single = buildRouteGeoJSON(streams);
    if (single) return [{ route: single, color: '#60a5fa', label: '' }];
    return [];
  });

  const mergedBounds = $derived.by(() => {
    if (routesWithData.length === 0) return null;
    return mergeBounds(routesWithData.map((r) => r.route!.bounds));
  });

  const center = $derived.by(() => {
    if (!mergedBounds) return undefined;
    const { minLng, maxLng, minLat, maxLat } = mergedBounds;
    return [(minLng + maxLng) / 2, (minLat + maxLat) / 2] as [number, number];
  });

  const boundsForFit = $derived(
    mergedBounds
      ? ([
          [mergedBounds.minLng, mergedBounds.minLat],
          [mergedBounds.maxLng, mergedBounds.maxLat],
        ] as [[number, number], [number, number]])
      : null
  );

  function handleLoad(ev: { target: MapLibreMap }) {
    if (!boundsForFit) return;
    try {
      ev.target.fitBounds(boundsForFit, { padding: 40, maxZoom: 16 });
    } catch {
      // ignore
    }
  }
</script>

{#if routesWithData.length > 0 && center}
  <div class="relative">
    <div class="absolute top-2 left-2 z-10 flex gap-2">
      <div
        class="rounded-lg border border-border bg-surface/85 px-3 py-1.5 shadow-sm backdrop-blur"
      >
        <select
          bind:value={selectedTheme}
          class="border-0 bg-transparent text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
        >
          {#each THEME_OPTIONS as option}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
      </div>
      <button
        type="button"
        onclick={() => (showLabels = !showLabels)}
        class="rounded-lg border border-border bg-surface/85 px-3 py-1.5 text-sm text-text-primary shadow-sm backdrop-blur transition-colors hover:bg-surface/95 focus:outline-none focus:ring-2 focus:ring-accent"
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
        {center}
        zoom={12}
        onload={handleLoad}
        autoloadGlobalCss={false}
      >
        <NavigationControl position="top-right" />
        <FullScreenControl position="top-right" />
        {#if routes?.length && routesWithData.length > 0}
          <CustomControl position="bottom-left" group={false}>
            <div
              class="m-2 rounded-lg border border-border bg-surface/85 px-3 py-2 shadow-sm backdrop-blur"
            >
              <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-text-secondary">
                {#each routesWithData as item}
                  <div class="flex items-center gap-2">
                    <span
                      class="h-3 w-3 shrink-0 rounded-sm"
                      style="background-color: {item.color};"
                      aria-hidden="true"
                    ></span>
                    <span class="text-text-primary">{item.label}</span>
                  </div>
                {/each}
              </div>
            </div>
          </CustomControl>
        {/if}
        {#each routesWithData as item, i}
          {@const sourceId = `route-source-${i}`}
          {@const layerId = `route-layer-${i}`}
          {@const arrowLayerId = `${ROUTE_ARROW_LAYER_PREFIX}${i}`}
          <GeoJSONSource data={item.route!.route} id={sourceId}>
            <LineLayer
              id={layerId}
              paint={{ 'line-color': item.color, 'line-width': 4 }}
              layout={{ 'line-join': 'round', 'line-cap': 'round' }}
            />
            <SymbolLayer
              id={arrowLayerId}
              source={sourceId}
              layout={{
                'symbol-placement': 'line',
                'icon-image': ROUTE_ARROW_IMAGE_ID,
                'icon-size': 3,
                'symbol-spacing': 100,
                'icon-rotation-alignment': 'map',
                'icon-allow-overlap': true,
              }}
              paint={{ 'icon-color': item.color }}
            />
          </GeoJSONSource>
        {/each}
      </MapLibre>
    </div>
  </div>
{/if}
