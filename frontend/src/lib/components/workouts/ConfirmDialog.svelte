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
    /** When set, shown in a prominent warning box below the message */
    warningMessage?: string;
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
    warningMessage,
    onConfirm,
    onCancel,
  }: Props = $props();
</script>

<svelte:window onkeydown={(e) => { if (e.key === 'Escape') onCancel(); }} />

<div
  class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
  role="dialog"
  aria-modal="true"
  aria-labelledby="confirm-dialog-title"
  onclick={onCancel}
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
    <p class="mb-4 text-sm text-text-secondary">
      {message}
    </p>
    {#if warningMessage}
      <div
        class="mb-6 flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200"
        role="alert"
      >
        <span class="material-icons shrink-0 text-base text-amber-400" aria-hidden="true"
          >warning</span
        >
        <p>{warningMessage}</p>
      </div>
    {/if}
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
