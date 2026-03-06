<script lang="ts">
  // Simple login page with OAuth provider buttons
  import googleIcon from '../assets/auth/google-g.svg';
  import githubIcon from '../assets/auth/github-mark.svg';

  function signInWith(provider: 'google' | 'github') {
    // Full page navigation to backend OAuth endpoints
    window.location.assign(`/api/auth/${provider}`);
  }

  const baseButtonClasses =
    'flex items-center justify-center gap-2 rounded px-4 py-2 font-medium hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-offset-2';
  const googleButtonClasses =
    baseButtonClasses + ' bg-white text-gray-900 focus:ring-gray-400 focus:ring-offset-white';
  const githubButtonClasses =
    baseButtonClasses + ' bg-black text-white focus:ring-white focus:ring-offset-black';
</script>

<div class="min-h-screen flex items-center justify-center bg-surface">
  <div class="w-full max-w-md rounded-lg border border-border bg-card p-8 shadow">
    <div class="mb-6 flex items-center justify-center gap-3">
      <span class="material-icons text-3xl text-text-primary">fitness_center</span>
      <h1 class="text-xl font-semibold text-text-primary">OpenFitLab</h1>
    </div>
    <p class="mb-6 text-center text-text-secondary">Sign in to continue</p>
    <div class="flex flex-col gap-3">
      <button class={googleButtonClasses} onclick={() => signInWith('google')}>
        <img src={googleIcon} alt="" class="h-6 w-6 shrink-0" width="24" height="24" />
        Continue with Google
      </button>
      <button class={githubButtonClasses} onclick={() => signInWith('github')}>
        <img src={githubIcon} alt="" class="h-6 w-6 shrink-0" width="24" height="24" />
        Continue with GitHub
      </button>
    </div>
  </div>
</div>
