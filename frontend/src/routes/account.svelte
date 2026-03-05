<script lang="ts">
  import { push } from 'svelte-spa-router';
  import {
    deleteAccount,
    exportUserData,
    getAnalyticsEnabled,
    setAnalyticsEnabled,
  } from '../lib/api';
  import { setCurrentUser } from '../lib/stores/auth.svelte';
  import LoadingSpinner from '../lib/components/LoadingSpinner.svelte';

  const CONFIRM_PHRASE = 'DELETE';

  let confirmChecked = $state(false);
  let confirmText = $state('');
  let isDeleting = $state(false);
  let error = $state<string | null>(null);
  let analyticsEnabled = $state(getAnalyticsEnabled());
  let isExporting = $state(false);
  let exportError = $state<string | null>(null);

  const canDelete = $derived(confirmChecked && confirmText.trim().toUpperCase() === CONFIRM_PHRASE);

  function toggleAnalytics() {
    analyticsEnabled = !analyticsEnabled;
    setAnalyticsEnabled(analyticsEnabled);
  }

  async function handleExport(includeStreams: boolean) {
    isExporting = true;
    exportError = null;
    const result = await exportUserData(includeStreams);
    if (result.ok) {
      const blob = new Blob([JSON.stringify(result.data, null, 2)], {
        type: 'application/json',
      });
      const date = new Date().toISOString().slice(0, 10);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `openfitlab-export-${date}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      exportError = result.error ?? 'Export failed. Please try again.';
    }
    isExporting = false;
  }

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
    Manage your privacy settings, export your data, or delete your account.
  </p>

  <!-- Privacy Settings -->
  <div class="mb-8 rounded-lg border border-border bg-card p-6 shadow backdrop-blur-lg">
    <h2 class="mb-4 text-xl font-semibold text-text-primary">Privacy Settings</h2>

    <div class="flex flex-col gap-6">
      <div class="flex flex-wrap items-center justify-between gap-4 rounded-md bg-surface/50 p-4">
        <div>
          <h3 class="font-medium text-text-primary">Analytics</h3>
          <p class="mt-1 text-sm text-text-secondary">
            Allow anonymous usage analytics to help improve the service. You can opt out at any
            time.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={analyticsEnabled}
          aria-label="Allow anonymous usage analytics"
          onclick={toggleAnalytics}
          class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border border-border bg-surface transition-colors focus:outline-none focus:ring-2 focus:ring-accent {analyticsEnabled
            ? 'bg-accent'
            : 'bg-surface'}"
        >
          <span
            class="pointer-events-none inline-block h-5 w-5 translate-y-0.5 transform rounded-full bg-white shadow ring-0 transition duration-200 {analyticsEnabled
              ? 'translate-x-6'
              : 'translate-x-0.5'}"
          ></span>
        </button>
      </div>

      <div class="rounded-md bg-surface/50 p-4">
        <h3 class="font-medium text-text-primary">Data Export</h3>
        <p class="mt-1 mb-3 text-sm text-text-secondary">
          Download all your data in JSON format. Optionally include stream time-series data (larger
          file).
        </p>
        <div class="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={isExporting}
            onclick={() => handleExport(false)}
            class="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {#if isExporting}
              <span class="inline-flex items-center gap-2">
                <LoadingSpinner />
                Exporting…
              </span>
            {:else}
              Export (metadata only)
            {/if}
          </button>
          <button
            type="button"
            disabled={isExporting}
            onclick={() => handleExport(true)}
            class="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-card-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            Export (with streams)
          </button>
        </div>
        {#if exportError}
          <p class="mt-2 text-sm font-medium text-danger">{exportError}</p>
        {/if}
      </div>
    </div>
  </div>

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
