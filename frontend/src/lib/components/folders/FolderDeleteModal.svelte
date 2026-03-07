<script lang="ts">
  import type { Folder } from '../../types/event';
  import { deleteFolder } from '../../api/folders';

  interface Props {
    folder: Folder | null;
    onDone: () => void;
    onClosed: () => void;
    onError: (message: string) => void;
  }
  let { folder, onDone, onClosed, onError }: Props = $props();

  let deleting = $state(false);

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

{#if folder}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    role="dialog"
    aria-modal="true"
    aria-labelledby="folder-delete-title"
  >
    <div
      class="w-full max-w-md rounded-lg border border-border bg-surface p-4 shadow-xl"
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
