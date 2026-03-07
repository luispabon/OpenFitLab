<script lang="ts">
  import { FOLDER_PRESET_COLORS } from '../../types/event';
  import type { Folder } from '../../types/event';
  import { createFolder } from '../../api/folders';

  interface Props {
    open: boolean;
    onCreated: (folder: Folder) => void;
    onClosed: () => void;
    onError: (message: string) => void;
    existingNames: string[];
    maxFolders: number;
  }
  let { open, onCreated, onClosed, onError, existingNames = [], maxFolders = 20 }: Props = $props();

  let name = $state('');
  let color = $state<string>(FOLDER_PRESET_COLORS[0]);
  let submitting = $state(false);

  const nameTrimmed = $derived(name.trim());
  const nameTaken = $derived(
    existingNames.some((n) => n.toLowerCase() === nameTrimmed.toLowerCase())
  );
  const canSubmit = $derived(nameTrimmed.length > 0 && !nameTaken && !submitting);
  const atLimit = $derived(existingNames.length >= maxFolders);

  async function handleSubmit() {
    if (!canSubmit || atLimit) return;
    submitting = true;
    try {
      const folder = await createFolder({ name: nameTrimmed, color });
      onCreated(folder);
      name = '';
      color = FOLDER_PRESET_COLORS[0];
      onClosed();
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to create folder');
    } finally {
      submitting = false;
    }
  }

  function handleCancel() {
    name = '';
    onClosed();
  }
</script>

{#if open}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    role="dialog"
    aria-modal="true"
    aria-labelledby="folder-create-title"
  >
    <div
      class="w-full max-w-sm rounded-lg border border-border bg-surface p-4 shadow-xl"
      role="presentation"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
    >
      <h2 id="folder-create-title" class="mb-3 text-lg font-medium text-text-primary">
        New folder
      </h2>
      {#if atLimit}
        <p class="mb-3 text-sm text-amber-600">
          Maximum {maxFolders} folders reached. Delete or unfile a folder to create another.
        </p>
      {:else}
        <div class="mb-3">
          <label for="folder-create-name" class="mb-1 block text-sm text-text-secondary">
            Name
          </label>
          <input
            id="folder-create-name"
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
        <div class="mb-4">
          <span class="mb-2 block text-sm text-text-secondary">Color</span>
          <div class="flex flex-wrap gap-2">
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
        </div>
        <div class="flex justify-end gap-2">
          <button
            type="button"
            class="rounded border border-border px-3 py-1.5 text-sm font-medium text-text-primary hover:bg-card-hover"
            onclick={handleCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            class="rounded bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
            disabled={!canSubmit}
            onclick={handleSubmit}
          >
            Create
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}
