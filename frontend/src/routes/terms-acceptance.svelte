<script lang="ts">
  import { completeSignup, declineSignup } from '../lib/api/auth';
  import { termsOfServiceContent } from '../lib/content/terms';
  import { state as authState, checkAuth } from '../lib/stores/auth.svelte';
  import { privacyConfig } from '../lib/config/privacy.js';
  import { push } from 'svelte-spa-router';

  let accepted = $state(false);
  let isSubmitting = $state(false);
  let isDeclining = $state(false);
  let error = $state<string | null>(null);

  async function handleAccept() {
    if (!accepted) return;
    isSubmitting = true;
    error = null;

    const result = await completeSignup();
    if (result.ok) {
      await checkAuth();
      push('/');
    } else {
      error = result.error ?? 'Failed to create account. Please try again.';
      isSubmitting = false;
    }
  }

  async function handleDecline() {
    isDeclining = true;
    error = null;

    const result = await declineSignup();
    if (result.ok) {
      authState.user = null;
      authState.csrfToken = null;
      authState.pendingSignup = false;
      authState.pendingProfile = null;
      push('/');
    } else {
      error = result.error ?? 'Failed to cancel signup. Please try again.';
      isDeclining = false;
    }
  }
</script>

<div class="min-h-screen flex items-center justify-center bg-surface p-4">
  <div class="w-full max-w-2xl rounded-lg border border-border bg-card p-8 shadow">
    <h1 class="mb-2 text-2xl font-semibold text-text-primary">Welcome to OpenFitLab</h1>
    <p class="mb-6 text-sm text-text-secondary">
      Hello {#if authState.pendingProfile?.displayName}{authState.pendingProfile
          .displayName}{:else}there{/if}! To complete your account setup, please review and accept
      our Terms of Service.
    </p>

    <!-- Terms Content Scroll Area (source: docs/TERMS_OF_SERVICE.html, bundled at build time) -->
    <div
      class="mb-6 max-h-64 overflow-y-auto rounded border border-border bg-surface p-4 text-sm text-text-secondary"
    >
      <div
        class="terms-doc [&_h1]:mb-3 [&_h1]:text-lg [&_h1]:font-semibold [&_h1]:text-text-primary [&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-text-primary [&_p]:mb-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_li]:mb-1 [&_a]:text-accent [&_a]:underline [&_a]:hover:opacity-90"
      >
        {@html termsOfServiceContent}
      </div>
    </div>

    <!-- Privacy Policy Link -->
    <div class="mb-6 rounded border border-border bg-surface/50 p-4">
      <h3 class="mb-2 font-medium text-text-primary flex items-center gap-2">
        <span class="material-icons text-sm">privacy_tip</span>
        Privacy Policy
      </h3>
      <p class="text-sm text-text-secondary">
        Please review our
        <a href="#/privacy" target="_blank" class="text-accent hover:underline">Privacy Policy</a>
        to understand how we collect, use, and protect your data.
        {#if privacyConfig.email}
          For questions:
          <a href="mailto:{privacyConfig.email}" class="text-accent hover:underline"
            >{privacyConfig.email}</a
          >
        {/if}
      </p>
    </div>

    <!-- Session expiry notice -->
    <p class="mb-4 text-xs text-text-secondary">
      This signup session will expire in 10 minutes for security purposes.
    </p>

    <!-- Acceptance Checkbox -->
    <label class="mb-6 flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        bind:checked={accepted}
        class="mt-1 h-4 w-4 rounded border-border text-accent focus:ring-accent"
      />
      <span class="text-sm text-text-primary">
        I have read and agree to the Terms of Service. I understand that continued use is subject to
        these terms.
      </span>
    </label>

    {#if error}
      <p class="mb-4 text-sm font-medium text-danger">{error}</p>
    {/if}

    <div class="flex flex-col gap-3">
      <button
        type="button"
        onclick={handleAccept}
        disabled={!accepted || isSubmitting || isDeclining}
        class="w-full rounded bg-accent px-4 py-2 font-medium text-white hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {#if isSubmitting}
          <span class="inline-flex items-center gap-2">
            <span class="material-icons animate-spin text-sm">refresh</span>
            Creating account...
          </span>
        {:else}
          Accept and Continue
        {/if}
      </button>

      <button
        type="button"
        onclick={handleDecline}
        disabled={isSubmitting || isDeclining}
        class="w-full rounded border border-border px-4 py-2 font-medium text-text-primary hover:bg-card-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {#if isDeclining}
          <span class="inline-flex items-center gap-2">
            <span class="material-icons animate-spin text-sm">refresh</span>
            Cancelling...
          </span>
        {:else}
          Decline and Cancel
        {/if}
      </button>
    </div>
  </div>
</div>
