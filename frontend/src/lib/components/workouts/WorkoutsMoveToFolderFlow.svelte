<script lang="ts">
  import type { Folder } from '../../types';

  interface Props {
    eventIdsToMove: string[];
    folders: Folder[];
    updateEventFolder: (eventId: string, folderId: string | null) => Promise<unknown>;
    onDone: (movedCount: number) => void;
    onClosed: () => void;
    onError: (message: string) => void;
  }
  let { eventIdsToMove, folders, updateEventFolder, onDone, onClosed, onError }: Props = $props();

  let moving = $state(false);

  const open = $derived(eventIdsToMove.length > 0);
  const sortedFolders = $derived([...folders].sort((a, b) => a.name.localeCompare(b.name)));

  async function moveTo(folderId: string | null) {
    if (eventIdsToMove.length === 0) return;
    moving = true;
    let successCount = 0;
    try {
      for (const eventId of eventIdsToMove) {
        await updateEventFolder(eventId, folderId);
        successCount += 1;
      }
      onDone(successCount);
      onClosed();
    } catch (error) {
      console.error('Move to folder failed:', error);
      onError(error instanceof Error ? error.message : 'Failed to move event(s)');
    } finally {
      moving = false;
    }
  }
</script>

<svelte:window onkeydown={(e) => open && e.key === 'Escape' && onClosed()} />

{#if open}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    role="dialog"
    aria-modal="true"
    aria-labelledby="move-to-folder-title"
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
      class="max-h-[80vh] w-full max-w-sm overflow-hidden rounded-lg border border-border bg-surface-solid shadow-xl"
      role="presentation"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
    >
      <div class="border-b border-border px-4 py-3">
        <h2 id="move-to-folder-title" class="text-lg font-medium text-text-primary">
          Move to folder
        </h2>
        <p class="mt-1 text-sm text-text-secondary">
          {eventIdsToMove.length} event{eventIdsToMove.length !== 1 ? 's' : ''} selected
        </p>
      </div>
      <div class="max-h-96 overflow-y-auto p-2">
        <button
          type="button"
          class="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-text-primary hover:bg-card-hover disabled:opacity-50"
          disabled={moving}
          onclick={() => moveTo(null)}
        >
          <span class="material-icons text-base text-text-secondary">folder_off</span>
          <span>Unfiled</span>
        </button>
        {#each sortedFolders as folder (folder.id)}
          <button
            type="button"
            class="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-text-primary hover:bg-card-hover disabled:opacity-50"
            disabled={moving}
            onclick={() => moveTo(folder.id)}
          >
            <span
              class="material-icons text-base shrink-0"
              style="color: {folder.color || '#64748b'};"
              aria-hidden="true">folder</span
            >
            <span class="truncate">{folder.name}</span>
          </button>
        {/each}
      </div>
      <div class="border-t border-border px-4 py-2">
        <button
          type="button"
          class="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-text-primary hover:bg-card-hover"
          disabled={moving}
          onclick={onClosed}
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
{/if}
