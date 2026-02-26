<script lang="ts">
  // Simple login page with OAuth provider buttons
  function signInWith(provider: 'google' | 'github') {
    // Full page navigation to backend OAuth endpoints
    window.location.assign(`/api/auth/${provider}`);
  }
</script>

<div class="min-h-screen flex items-center justify-center bg-surface">
  <div class="w-full max-w-md rounded-lg border border-border bg-card p-8 shadow">
    <div class="mb-6 flex items-center justify-center gap-3">
      <span class="material-icons text-3xl text-text-primary">fitness_center</span>
      <h1 class="text-xl font-semibold text-text-primary">OpenFitLab</h1>
    </div>
    <p class="mb-6 text-center text-text-secondary">Sign in to continue</p>
    <div class="flex flex-col gap-3">
      <button
        class="flex items-center justify-center gap-2 rounded bg-accent px-4 py-2 font-medium text-white hover:opacity-95"
        onclick={() => signInWith('google')}
      >
        <span class="material-icons">login</span>
        Continue with Google
      </button>
      <button
        class="flex items-center justify-center gap-2 rounded border border-border px-4 py-2 text-text-primary hover:bg-card-hover"
        onclick={() => signInWith('github')}
      >
        <span class="material-icons">code</span>
        Continue with GitHub
      </button>
    </div>
  </div>
</div>
