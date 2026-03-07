<script lang="ts">
  import type { Folder } from '../../types/event';
  import { updateFolder } from '../../api/folders';

  interface Props {
    folder: Folder | null;
    existingNames: string[];
    onDone: () => void;
    onClosed: () => void;
    onError: (message: string) => void;
  }
  let { folder, existingNames = [], onDone, onClosed, onError }: Props = $props();

  let name = $state('');
  let submitting = $state(false);

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

{#if folder}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    role="dialog"
    aria-modal="true"
    aria-labelledby="folder-rename-title"
  >
    <div
      class="w-full max-w-sm rounded-lg border border-border bg-surface p-4 shadow-xl"
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
