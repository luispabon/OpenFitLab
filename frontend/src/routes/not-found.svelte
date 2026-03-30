<script lang="ts">
  import { push } from 'svelte-spa-router';
</script>

<section class="mx-auto w-full max-w-screen-2xl px-4 sm:px-6 py-6">
  <div class="rounded-lg border border-border bg-card p-8 text-center backdrop-blur-lg">
    <h1 class="text-2xl font-semibold text-text-primary">Page not found</h1>
    <p class="mt-2 text-sm text-text-secondary">
      The page you're looking for doesn't exist or has been moved.
    </p>
    <button
      type="button"
      class="mt-6 rounded border border-border bg-surface px-4 py-2 text-sm font-medium text-text-primary hover:bg-card-hover focus:outline-none focus:ring-2 focus:ring-accent"
      onclick={() => push('/')}
    >
      Back to Workouts
    </button>
  </div>
</section>
