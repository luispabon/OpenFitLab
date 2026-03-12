<script lang="ts">
  // Simple login page with OAuth provider buttons
  import logoBig from '../assets/logo-big.svg';
  import googleIcon from '../assets/auth/google-g.svg';
  import githubIcon from '../assets/auth/github-mark.svg';
  import appleIcon from '../assets/auth/apple-logo.svg';
  import facebookIcon from '../assets/auth/facebook-f.svg';

  function signInWith(provider: 'google' | 'github' | 'apple' | 'facebook') {
    // Full page navigation to backend OAuth endpoints
    window.location.assign(`/api/auth/${provider}`);
  }

  const baseButtonClasses =
    'flex items-center justify-center gap-2 rounded px-4 py-2 font-medium hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-offset-2';
  const googleButtonClasses =
    baseButtonClasses + ' bg-white text-gray-900 focus:ring-gray-400 focus:ring-offset-white';
  const githubButtonClasses =
    baseButtonClasses + ' bg-black text-white focus:ring-white focus:ring-offset-black';
  const appleButtonClasses =
    baseButtonClasses + ' bg-white text-gray-900 focus:ring-gray-400 focus:ring-offset-white';
  const facebookButtonClasses =
    baseButtonClasses + ' bg-[#1877F2] text-white focus:ring-blue-400 focus:ring-offset-blue-600';
</script>

<div class="min-h-screen flex items-center justify-center bg-surface">
  <div class="w-full max-w-md rounded-lg border border-border bg-card p-8 shadow">
    <div class="mb-6 flex items-center justify-center">
      <img src={logoBig} alt="OpenFitLab" class="h-16" />
    </div>
    <p class="mb-6 text-center text-text-secondary">Sign in to continue</p>
    <div class="grid grid-cols-2 gap-3">
      <button class={googleButtonClasses} onclick={() => signInWith('google')}>
        <img src={googleIcon} alt="" class="h-6 w-6 shrink-0" width="24" height="24" />
        Google
      </button>
      <button class={githubButtonClasses} onclick={() => signInWith('github')}>
        <img src={githubIcon} alt="" class="h-6 w-6 shrink-0" width="24" height="24" />
        GitHub
      </button>
      <button class={appleButtonClasses} onclick={() => signInWith('apple')}>
        <img src={appleIcon} alt="" class="h-6 w-6 shrink-0" width="24" height="24" />
        Apple
      </button>
      <button class={facebookButtonClasses} onclick={() => signInWith('facebook')}>
        <img src={facebookIcon} alt="" class="h-6 w-6 shrink-0" width="24" height="24" />
        Facebook
      </button>
    </div>
  </div>
</div>
