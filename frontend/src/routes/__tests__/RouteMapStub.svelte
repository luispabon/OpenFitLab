<script lang="ts">
  interface Props {
    streams?: unknown[];
  }
  let { streams = [] }: Props = $props();
</script>

<div data-testid="route-map" data-streams-length={streams?.length ?? 0}></div>
