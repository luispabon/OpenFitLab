<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { Folder } from '../../types';
  import DropZoneOverlay from '../DropZoneOverlay.svelte';

  interface Props {
    isUploading: boolean;
    onFilesSelected: (files: File[]) => void;
    accept?: string;
    isDraggingOver?: boolean;
    /** When provided, show "Upload to" folder dropdown. */
    folders?: Folder[];
    /** Current upload target: 'all' | 'unfiled' | folder id. */
    uploadFolderId?: string;
    bulkBar?: Snippet;
    children?: Snippet;
  }
  let {
    isUploading,
    onFilesSelected,
    accept = '.json,.tcx,.fit,.gpx,.sml',
    isDraggingOver = $bindable(false),
    folders = [],
    uploadFolderId = $bindable('all'),
    bulkBar,
    children,
  }: Props = $props();

  function handleFileSelect(event: Event) {
    const target = event.target as HTMLInputElement;
    const files = target.files;
    if (!files || files.length === 0) return;
    onFilesSelected(Array.from(files));
    target.value = '';
  }

  function handleDragEnter(event: DragEvent) {
    if (isUploading) return;
    const types = event.dataTransfer?.types;
    if (types && Array.from(types).includes('Files')) {
      event.preventDefault();
      event.stopPropagation();
      isDraggingOver = true;
    }
  }

  function handleDragLeave(event: DragEvent) {
    const relatedTarget = event.relatedTarget as Node | null;
    const currentTarget = event.currentTarget as HTMLElement;
    if (!relatedTarget || !currentTarget.contains(relatedTarget)) {
      isDraggingOver = false;
    }
  }

  function handleDragOver(event: DragEvent) {
    const types = event.dataTransfer?.types;
    if (types && Array.from(types).includes('Files')) {
      event.preventDefault();
      event.stopPropagation();
      if (!isUploading) {
        isDraggingOver = true;
      }
    }
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    isDraggingOver = false;
    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) return;
    onFilesSelected(Array.from(files));
  }
</script>

<div
  class="min-h-full w-full"
  ondragenter={handleDragEnter}
  ondragover={handleDragOver}
  ondragleave={handleDragLeave}
  ondrop={handleDrop}
  role="region"
  aria-label="Workouts upload area"
>
  {#if isDraggingOver && !isUploading}
    <DropZoneOverlay visible={true} />
  {/if}

  <h1 class="mb-6 text-2xl font-semibold text-text-primary">Workouts</h1>

  <div class="mb-6 flex flex-wrap items-center justify-between gap-4">
    <div class="flex flex-wrap items-center gap-3">
      <label
        for="workouts-file-upload"
        class="inline-flex cursor-pointer items-center rounded-md border-0 bg-accent px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-transparent"
      >
        <svg
          class="mr-2 h-5 w-5"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>
        Upload Activity Files
      </label>
      {#if folders.length > 0}
        <label class="flex items-center gap-2 text-sm text-text-secondary">
          <span>Upload to:</span>
          <select
            class="rounded border border-border bg-surface px-2 py-1 text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            bind:value={uploadFolderId}
            disabled={isUploading}
          >
            <option value="unfiled">Unfiled</option>
            {#each [...folders].sort((a, b) => a.name.localeCompare(b.name)) as folder (folder.id)}
              <option value={folder.id}>{folder.name}</option>
            {/each}
          </select>
        </label>
      {/if}
    </div>
    <input
      id="workouts-file-upload"
      type="file"
      {accept}
      multiple
      class="hidden"
      onchange={handleFileSelect}
      disabled={isUploading}
    />
    {#if bulkBar}
      {@render bulkBar()}
    {/if}
  </div>
  {#if children}
    {@render children()}
  {/if}
</div>
