<script lang="ts">
  import { onMount } from 'svelte';

  interface Props {
    map?: unknown;
    style?: string;
    center?: [number, number];
    zoom?: number;
    onload?: (ev: { target: unknown }) => void;
    class?: string;
    autoloadGlobalCss?: boolean;
    children?: import('svelte').Snippet;
  }
  let {
    map = $bindable(undefined),
    onload,
    class: className = '',
    children,
    ...rest
  }: Props = $props();

  onMount(() => {
    const g = typeof globalThis !== 'undefined' ? (globalThis as Record<string, unknown>) : {};
    const addImageSpy = (g.__routeMapAddImageSpy as (...args: unknown[]) => void) ?? (() => {});
    const setLayoutPropertySpy =
      (g.__routeMapSetLayoutPropertySpy as (...args: unknown[]) => void) ?? (() => {});
    const styleLoadCbs: (() => void)[] = [];
    const fakeMap = {
      fitBounds: () => {},
      isStyleLoaded: () => true,
      addImage: addImageSpy,
      on: (ev: string, cb: () => void) => {
        if (ev === 'style.load') styleLoadCbs.push(cb);
      },
      off: () => {},
      getStyle: () => ({ layers: [{ id: 'labels-layer', type: 'symbol' }] }),
      setLayoutProperty: setLayoutPropertySpy,
      _fireStyleLoad: () => styleLoadCbs.forEach((cb) => cb()),
    };
    (g.__routeMapFakeMap as unknown) = fakeMap;
    map = fakeMap;
    onload?.({ target: map });
  });
</script>

<div data-testid="maplibre-stub" class={className} {...rest}>
  {#if children}
    {@render children()}
  {/if}
</div>
