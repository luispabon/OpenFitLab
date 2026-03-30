<script lang="ts">
  import Router, { location } from 'svelte-spa-router';
  import { wrap } from 'svelte-spa-router/wrap';
  import Workouts from './routes/workouts.svelte';
  import Comparisons from './routes/comparisons.svelte';
  import Account from './routes/account.svelte';
  import LoginPage from './routes/login.svelte';
  import Privacy from './routes/privacy.svelte';
  import TermsAcceptance from './routes/terms-acceptance.svelte';
  import NotFound from './routes/not-found.svelte';
  import LoadingSpinner from './lib/components/LoadingSpinner.svelte';
  import FolderSidebar from './lib/components/FolderSidebar.svelte';
  import Footer from './lib/components/Footer.svelte';
  import { checkAuth, state as authState } from './lib/stores/auth.svelte';
  import {
    loadFolders,
    foldersState,
    getFolderFromHash,
    setFolderHash,
  } from './lib/stores/folders.svelte';
  import { trackPageView } from './lib/analytics/gtag.js';
  import { workoutDragState } from './lib/stores/workout-drag.svelte';

  const routes = {
    '/': Workouts,
    // svelte-spa-router wrap() expects Svelte 4 ComponentType; we use Svelte 5. Cast to satisfy typecheck.
    '/event/:id': wrap({
      asyncComponent: () => import('./routes/event-detail.svelte'),
      loadingComponent: LoadingSpinner,
    } as never),
    '/comparisons': Comparisons,
    '/compare/:id': wrap({
      asyncComponent: () => import('./routes/comparison-view.svelte'),
      loadingComponent: LoadingSpinner,
    } as never),
    '/account': Account,
    '/privacy': Privacy,
    '*': NotFound,
  };

  const unauthenticatedRoutes = {
    '/': LoginPage,
    '/privacy': Privacy,
    '*': LoginPage,
  };

  const pendingSignupRoutes = {
    '/': TermsAcceptance,
    '/privacy': Privacy,
    '*': TermsAcceptance,
  };

  let sidebarCollapsed = $state(localStorage.getItem('sidebarCollapsed') === 'true');

  $effect(() => {
    localStorage.setItem('sidebarCollapsed', String(sidebarCollapsed));
  });

  $effect(() => {
    setFolderHash(window.location.hash);
    const onHashChange = () => setFolderHash(window.location.hash);
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  });

  // Check auth on app load
  $effect(() => {
    checkAuth();
  });

  // Load folders when user is authenticated
  $effect(() => {
    if (authState.user) {
      loadFolders();
    }
  });

  function toggleSidebar() {
    sidebarCollapsed = !sidebarCollapsed;
  }

  const currentLocation = $derived($location);
  const isWorkoutsActive = $derived(currentLocation === '/' || currentLocation === '');
  const isComparisonsActive = $derived(currentLocation.startsWith('/comparisons'));

  const activeFolderValue = $derived(getFolderFromHash(foldersState.currentHash));

  // Track page views when route changes (SPA)
  $effect(() => {
    const path = '/' + (currentLocation || '');
    trackPageView(path);
  });

  const sidebarWidth = $derived(sidebarCollapsed ? '4rem' : '16rem');
  const sidebarEffectivelyExpanded = $derived(!sidebarCollapsed || workoutDragState.isDragging);
</script>

<div class="min-h-screen flex">
  <FolderSidebar
    {sidebarCollapsed}
    {sidebarEffectivelyExpanded}
    {isWorkoutsActive}
    {isComparisonsActive}
    {activeFolderValue}
    folders={foldersState.folders}
    onToggleSidebar={toggleSidebar}
  />

  <!-- Main Content -->
  <main
    class="flex min-w-0 flex-1 flex-col transition-all duration-300"
    style="margin-left: {sidebarWidth};"
  >
    <div class="flex-1">
      {#if authState.authLoading}
        <div class="grid place-items-center p-8">
          <LoadingSpinner />
        </div>
      {:else if authState.pendingSignup}
        <Router routes={pendingSignupRoutes} />
      {:else if !authState.user}
        <Router routes={unauthenticatedRoutes} />
      {:else}
        <Router {routes} />
      {/if}
    </div>
    <Footer />
  </main>
</div>
