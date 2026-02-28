<script lang="ts">
  interface Props {
    children?: import('svelte').Snippet;
    [key: string]: unknown;
  }
  let { children, ...rest }: Props = $props();
</script>

<div data-testid="maplibre-slot-stub" {...rest}>
  {#if children}
    {@render children()}
  {/if}
</div>
