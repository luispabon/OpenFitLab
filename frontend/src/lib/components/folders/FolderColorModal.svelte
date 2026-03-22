<script lang="ts">
  import { FOLDER_PRESET_COLORS } from '../../types/event';
  import type { Folder } from '../../types/event';
  import { updateFolder } from '../../api/folders';

  interface Props {
    folder: Folder | null;
    anchorEl?: HTMLElement | null;
    onDone: () => void;
    onClosed: () => void;
    onError: (message: string) => void;
  }
  let { folder, anchorEl, onDone, onClosed, onError }: Props = $props();

  let color = $state<string>('');
  let submitting = $state(false);
  let dialogTop = $state(0);
  let dialogLeft = $state(0);

  $effect(() => {
    if (folder && anchorEl) {
      const rect = anchorEl.getBoundingClientRect();
      const PANEL_WIDTH = 320;
      const GAP = 8;
      dialogLeft = Math.min(rect.right + GAP, window.innerWidth - PANEL_WIDTH - GAP);
      dialogTop = Math.min(rect.top, window.innerHeight - 200);
    }
  });

  $effect(() => {
    if (folder) {
      color = folder.color;
    }
  });

  const canSubmit = $derived(folder && color.length > 0 && !submitting);

  async function handleSubmit() {
    if (!folder || !canSubmit) return;
    submitting = true;
    try {
      await updateFolder(folder.id, { color });
      onDone();
      onClosed();
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to update color');
    } finally {
      submitting = false;
    }
  }
</script>

<svelte:window
  onkeydown={(e) => {
    if (e.key === 'Escape' && folder) onClosed();
  }}
/>

{#if folder}
  <div
    class="fixed inset-0 z-50 bg-black/50"
    role="dialog"
    aria-modal="true"
    aria-labelledby="folder-color-title"
    tabindex="-1"
    onclick={onClosed}
    onkeydown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClosed();
      }
    }}
  >
    <div
      class="fixed w-80 rounded-lg border border-border bg-surface-solid p-4 shadow-xl"
      style="top: {dialogTop}px; left: {dialogLeft}px;"
      role="presentation"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
    >
      <h2 id="folder-color-title" class="mb-3 text-lg font-medium text-text-primary">
        Folder color
      </h2>
      <div class="mb-4 flex flex-wrap gap-2">
        {#each FOLDER_PRESET_COLORS as c}
          <button
            type="button"
            class="h-8 w-8 rounded-full border-2 transition focus:outline-none focus:ring-2 focus:ring-accent"
            style="background-color: {c}; border-color: {color === c
              ? 'var(--color-text-primary)'
              : 'transparent'};"
            onclick={() => (color = c)}
            aria-label="Color {c}"
          ></button>
        {/each}
      </div>
      <div class="flex justify-end gap-2">
        <button
          type="button"
          class="rounded border border-border px-3 py-1.5 text-sm font-medium text-text-primary hover:bg-card-hover"
          onclick={onClosed}
        >
          Cancel
        </button>
        <button
          type="button"
          class="rounded bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
          disabled={!canSubmit}
          onclick={handleSubmit}
        >
          Save
        </button>
      </div>
    </div>
  </div>
{/if}
