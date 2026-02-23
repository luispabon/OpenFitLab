<script lang="ts">
  interface Props {
    visible: boolean;
  }

  let { visible }: Props = $props();
</script>

{#if visible}
  <div
    class="fixed inset-0 z-40 flex items-center justify-center bg-black/30 backdrop-blur-sm"
    role="dialog"
    aria-label="Drop files to upload"
  >
    <div
      class="animate-[pulse-scale_2s_ease-in-out_infinite] rounded-xl border-4 border-accent bg-surface p-12 shadow-2xl"
    >
      <div class="flex flex-col items-center gap-4">
        <span class="material-icons text-6xl text-accent" aria-hidden="true">cloud_upload</span>
        <h2 class="text-2xl font-semibold text-text-primary">Drop files here to upload</h2>
        <p class="text-sm text-text-secondary">Supported formats: TCX, FIT, GPX, JSON, SML</p>
      </div>
    </div>
  </div>
{/if}

<style>
  @keyframes pulse-scale {
    0%,
    100% {
      transform: scale(1);
      opacity: 1;
    }
    50% {
      transform: scale(1.02);
      opacity: 0.95;
    }
  }
</style>
