<script lang="ts">
  import type { Folder } from '../../types/event';
  import { deleteFolder } from '../../api/folders';

  interface Props {
    folder: Folder | null;
    anchorEl?: HTMLElement | null;
    onDone: () => void;
    onClosed: () => void;
    onError: (message: string) => void;
  }
  let { folder, anchorEl, onDone, onClosed, onError }: Props = $props();

  let deleting = $state(false);
  let dialogTop = $state(0);
  let dialogLeft = $state(0);

  $effect(() => {
    if (folder && anchorEl) {
      const rect = anchorEl.getBoundingClientRect();
      const PANEL_WIDTH = 320;
      const GAP = 8;
      dialogLeft = Math.min(rect.right + GAP, window.innerWidth - PANEL_WIDTH - GAP);
      dialogTop = Math.min(rect.top, window.innerHeight - 320);
    }
  });

  async function handleDelete(m: 'unfile' | 'delete') {
    if (!folder) return;
    deleting = true;
    try {
      await deleteFolder(folder.id, m);
      onDone();
      onClosed();
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to delete folder');
    } finally {
      deleting = false;
    }
  }
</script>

<svelte:window
  onkeydown={(e) => {
    if (e.key === 'Escape' && folder && !deleting) onClosed();
  }}
/>

{#if folder}
  <div
    class="fixed inset-0 z-50 bg-black/50"
    role="dialog"
    aria-modal="true"
    aria-labelledby="folder-delete-title"
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
      <h2 id="folder-delete-title" class="mb-2 text-lg font-medium text-text-primary">
        Delete folder &quot;{folder.name}&quot;?
      </h2>
      <p class="mb-4 text-sm text-text-secondary">
        Choose what to do with the events and comparisons in this folder.
      </p>
      <div class="flex flex-col gap-2">
        <button
          type="button"
          class="rounded border border-border px-3 py-2 text-left text-sm font-medium text-text-primary hover:bg-card-hover disabled:opacity-50"
          disabled={deleting}
          onclick={() => handleDelete('unfile')}
        >
          Move contents to Unfiled
        </button>
        <button
          type="button"
          class="rounded border border-danger/50 px-3 py-2 text-left text-sm font-medium text-danger hover:bg-danger/10 disabled:opacity-50"
          disabled={deleting}
          onclick={() => handleDelete('delete')}
        >
          Delete all contents
        </button>
      </div>
      <div class="mt-4 flex justify-end">
        <button
          type="button"
          class="rounded border border-border px-3 py-1.5 text-sm font-medium text-text-primary hover:bg-card-hover"
          disabled={deleting}
          onclick={onClosed}
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
{/if}
