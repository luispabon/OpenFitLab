<script lang="ts">
  interface Props {
    title: string;
    message: string;
    confirmLabel: string;
    loadingLabel?: string;
    cancelLabel?: string;
    loading?: boolean;
    danger?: boolean;
    confirmDisabled?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
  }
  let {
    title,
    message,
    confirmLabel,
    loadingLabel = 'Deleting...',
    cancelLabel = 'Cancel',
    loading = false,
    danger = false,
    confirmDisabled = false,
    onConfirm,
    onCancel,
  }: Props = $props();
</script>

<div
  class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
  role="dialog"
  aria-modal="true"
  aria-labelledby="confirm-dialog-title"
  tabindex="-1"
  onclick={onCancel}
  onkeydown={(e) => {
    if (e.key === 'Escape') onCancel();
  }}
>
  <div
    class="w-full max-w-md rounded-lg border border-border bg-surface p-6 shadow-xl backdrop-blur-xl"
    role="presentation"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.stopPropagation()}
  >
    <h2 id="confirm-dialog-title" class="mb-4 text-lg font-semibold text-text-primary">
      {title}
    </h2>
    <p class="mb-6 text-sm text-text-secondary">
      {message}
    </p>
    <div class="flex justify-end gap-3">
      <button
        type="button"
        class="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-text-primary shadow-sm hover:bg-card-hover focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-transparent disabled:opacity-50"
        onclick={onCancel}
        disabled={confirmDisabled}
      >
        {cancelLabel}
      </button>
      <button
        type="button"
        class="rounded-md border-0 px-4 py-2 text-sm font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent disabled:opacity-50 {danger
          ? 'bg-danger hover:bg-danger-hover focus:ring-danger'
          : 'bg-accent hover:bg-accent-hover focus:ring-accent'}"
        onclick={onConfirm}
        disabled={confirmDisabled}
      >
        {#if loading}
          {loadingLabel}
        {:else}
          {confirmLabel}
        {/if}
      </button>
    </div>
  </div>
</div>
