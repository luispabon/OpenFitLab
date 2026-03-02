<script lang="ts">
  import { push } from 'svelte-spa-router';
  import { deleteAccount } from '../lib/api';
  import { setCurrentUser } from '../lib/stores/auth.svelte';
  import LoadingSpinner from '../lib/components/LoadingSpinner.svelte';

  const CONFIRM_PHRASE = 'DELETE';

  let confirmChecked = $state(false);
  let confirmText = $state('');
  let isDeleting = $state(false);
  let error = $state<string | null>(null);

  const canDelete = $derived(confirmChecked && confirmText.trim().toUpperCase() === CONFIRM_PHRASE);

  async function handleDelete() {
    if (!canDelete || isDeleting) return;

    isDeleting = true;
    error = null;
    const result = await deleteAccount();

    if (result.ok) {
      setCurrentUser(null);
      push('/');
      return;
    }

    isDeleting = false;
    error = result.error ?? 'Something went wrong. Please try again.';
  }
</script>

<section class="mx-auto w-[85%] max-w-screen-2xl py-6">
  <h1 class="mb-6 text-2xl font-semibold text-text-primary">Account</h1>
  <p class="mb-8 text-sm text-text-secondary">
    This page is for account deletion only. Data export may be added later.
  </p>

  <div class="rounded-lg border border-border border-danger/30 bg-card p-6 shadow backdrop-blur-lg">
    <h2 class="text-lg font-medium text-text-primary">Delete my account</h2>
    <p class="mt-2 text-sm text-text-secondary">
      Deleting your account will <strong class="text-danger">permanently</strong> remove:
    </p>
    <ul class="mt-2 list-inside list-disc text-sm text-text-secondary">
      <li>Your profile and sign-in links (e.g. Google, GitHub)</li>
      <li>All your events and activities (uploaded workouts)</li>
      <li>All your saved comparisons</li>
    </ul>
    <p class="mt-2 text-sm font-medium text-danger">This cannot be undone.</p>

    <div class="mt-6 space-y-4">
      <label class="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          bind:checked={confirmChecked}
          class="mt-1 h-4 w-4 rounded border-border text-accent focus:ring-accent"
          disabled={isDeleting}
        />
        <span class="text-sm text-text-primary">
          I understand that all my data will be permanently deleted.
        </span>
      </label>

      <div>
        <label for="confirm-delete-input" class="block text-sm text-text-primary">
          Type <code class="rounded bg-surface px-1 font-mono text-danger">{CONFIRM_PHRASE}</code> to
          confirm:
        </label>
        <input
          id="confirm-delete-input"
          type="text"
          bind:value={confirmText}
          placeholder={CONFIRM_PHRASE}
          class="mt-1 w-full max-w-xs rounded border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          disabled={isDeleting}
          autocomplete="off"
        />
      </div>

      {#if error}
        <p class="text-sm font-medium text-danger">{error}</p>
      {/if}

      <div class="flex items-center gap-3">
        <button
          type="button"
          onclick={handleDelete}
          disabled={!canDelete || isDeleting}
          class="rounded-md bg-danger px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-danger/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {#if isDeleting}
            <span class="inline-flex items-center gap-2">
              <LoadingSpinner />
              Deleting…
            </span>
          {:else}
            Permanently delete my account
          {/if}
        </button>
      </div>
    </div>
  </div>
</section>
