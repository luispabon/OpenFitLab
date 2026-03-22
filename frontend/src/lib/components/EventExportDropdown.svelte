<script lang="ts">
  import { downloadEventTcx, downloadEventGpx } from '../api/export';

  interface Props {
    eventId: string;
    eventName: string;
    hasGps: boolean;
  }
  let { eventId, eventName, hasGps }: Props = $props();

  let open = $state(false);
  let downloading = $state<'tcx' | 'gpx' | null>(null);
  let error = $state<string | null>(null);

  function toggle() {
    open = !open;
  }

  async function handleDownload(format: 'tcx' | 'gpx') {
    if (downloading) return;
    downloading = format;
    error = null;
    open = false;
    try {
      if (format === 'tcx') {
        await downloadEventTcx(eventId, eventName);
      } else {
        await downloadEventGpx(eventId, eventName);
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Export failed';
    } finally {
      downloading = null;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') open = false;
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="relative" data-export-exclude onkeydown={handleKeydown}>
  <button
    type="button"
    onclick={toggle}
    disabled={downloading !== null}
    class="inline-flex h-9 items-center gap-1.5 rounded border border-border bg-card px-3 text-sm text-text-secondary transition-colors hover:bg-card-hover hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
  >
    <span class="material-icons text-base" aria-hidden="true">
      {downloading !== null ? 'hourglass_empty' : 'download'}
    </span>
    Export
    <span class="material-icons text-sm" aria-hidden="true">expand_more</span>
  </button>

  {#if open}
    <div
      class="absolute right-0 top-full z-10 mt-1 min-w-[200px] rounded-md border border-border bg-card shadow-lg backdrop-blur-lg"
    >
      <div class="py-1">
        <button
          type="button"
          class="flex w-full items-center gap-2 px-4 py-2 text-sm text-text-primary hover:bg-card-hover"
          onclick={() => handleDownload('tcx')}
        >
          <span class="material-icons text-base" aria-hidden="true">download</span>
          Download TCX
        </button>
        {#if hasGps}
          <button
            type="button"
            class="flex w-full items-center gap-2 px-4 py-2 text-sm text-text-primary hover:bg-card-hover"
            onclick={() => handleDownload('gpx')}
          >
            <span class="material-icons text-base" aria-hidden="true">download</span>
            Download GPX
          </button>
        {/if}
      </div>
      <div class="border-t border-border px-4 py-2">
        <p class="text-xs italic text-text-secondary">
          Reconstructed from stored data — original file not retained
        </p>
      </div>
    </div>
  {/if}

  {#if error}
    <p class="mt-1 text-xs text-danger">{error}</p>
  {/if}
</div>
