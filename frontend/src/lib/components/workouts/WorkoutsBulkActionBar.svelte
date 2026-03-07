<script lang="ts">
  interface Props {
    selectedCount: number;
    disabled?: boolean;
    onClear: () => void;
    onCompare: () => void;
    onMove: () => void;
    onDelete: () => void;
  }
  let { selectedCount, disabled = false, onClear, onCompare, onMove, onDelete }: Props = $props();
</script>

{#if selectedCount > 0}
  <div
    class="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3 backdrop-blur"
  >
    <p class="text-sm font-medium text-text-primary">
      {selectedCount} event{selectedCount !== 1 ? 's' : ''} selected
    </p>
    <button
      type="button"
      class="rounded border-2 border-border bg-surface px-3 py-1.5 text-sm font-medium text-text-primary shadow-sm hover:bg-card-hover hover:border-text-secondary focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
      onclick={onClear}
      {disabled}
    >
      Clear
    </button>
    <button
      type="button"
      class="flex items-center rounded border-0 bg-accent px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-accent-hover focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
      onclick={onCompare}
      disabled={selectedCount < 2 || disabled}
    >
      <span class="material-icons text-sm leading-none mr-1" aria-hidden="true"
        >compare_arrows</span
      >
      Compare
    </button>
    <button
      type="button"
      class="flex items-center rounded border-0 bg-surface px-3 py-1.5 text-sm font-medium text-text-primary shadow-sm hover:bg-card-hover focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50 border border-border"
      onclick={onMove}
      {disabled}
      title="Move to folder"
    >
      <span class="material-icons text-sm leading-none mr-1" aria-hidden="true"
        >drive_file_move</span
      >
      Move
    </button>
    <button
      type="button"
      class="flex items-center rounded border-0 bg-danger px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-danger-hover focus:outline-none focus:ring-1 focus:ring-danger disabled:opacity-50"
      onclick={onDelete}
      {disabled}
    >
      <span class="material-icons text-sm leading-none mr-1" aria-hidden="true">delete</span>
      Delete
    </button>
  </div>
{/if}
