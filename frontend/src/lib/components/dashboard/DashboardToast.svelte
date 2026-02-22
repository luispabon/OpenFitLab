<script lang="ts">
  interface Props {
    message: string | null
  }
  let { message }: Props = $props()
</script>

{#if message}
  <div
    class="mb-4 rounded-md border border-border bg-card p-4 backdrop-blur"
    role="alert"
  >
    <p class="text-sm font-medium text-text-primary">{message}</p>
  </div>
{/if}
