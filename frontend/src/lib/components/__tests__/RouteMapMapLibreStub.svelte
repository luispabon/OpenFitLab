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
    const fakeMap = {
      fitBounds: () => {},
      isStyleLoaded: () => true,
      addImage: () => {},
      on: () => {},
      off: () => {},
      getStyle: () => ({ layers: [] }),
      setLayoutProperty: () => {},
    };
    map = fakeMap;
    onload?.({ target: map });
  });
</script>

<div data-testid="maplibre-stub" class={className} {...rest}>
  {#if children}
    {@render children()}
  {/if}
</div>
