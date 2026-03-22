<script lang="ts">
  import type { Folder } from '../../types/event';
  import { updateFolder } from '../../api/folders';

  interface Props {
    folder: Folder | null;
    existingNames: string[];
    anchorEl?: HTMLElement | null;
    onDone: () => void;
    onClosed: () => void;
    onError: (message: string) => void;
  }
  let { folder, existingNames = [], anchorEl, onDone, onClosed, onError }: Props = $props();

  let name = $state('');
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
      name = folder.name;
    }
  });

  const nameTrimmed = $derived(name.trim());
  const nameTaken = $derived(
    folder &&
      nameTrimmed.toLowerCase() !== folder.name.toLowerCase() &&
      existingNames.some((n) => n.toLowerCase() === nameTrimmed.toLowerCase())
  );
  const canSubmit = $derived(folder && nameTrimmed.length > 0 && !nameTaken && !submitting);

  async function handleSubmit() {
    if (!folder || !canSubmit) return;
    submitting = true;
    try {
      await updateFolder(folder.id, { name: nameTrimmed });
      onDone();
      onClosed();
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to rename folder');
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
    aria-labelledby="folder-rename-title"
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
      <h2 id="folder-rename-title" class="mb-3 text-lg font-medium text-text-primary">
        Rename folder
      </h2>
      <div class="mb-4">
        <input
          type="text"
          class="w-full rounded border border-border bg-surface px-3 py-2 text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          placeholder="Folder name"
          bind:value={name}
          maxlength="100"
        />
        {#if nameTaken && nameTrimmed.length > 0}
          <p class="mt-1 text-sm text-amber-600">A folder with this name already exists.</p>
        {/if}
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
