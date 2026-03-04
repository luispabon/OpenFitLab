<script lang="ts">
  import Router, { location } from 'svelte-spa-router';
  import Dashboard from './routes/dashboard.svelte';
  import EventDetail from './routes/event-detail.svelte';
  import Comparisons from './routes/comparisons.svelte';
  import ComparisonView from './routes/comparison-view.svelte';
  import Account from './routes/account.svelte';
  import LoginPage from './routes/login.svelte';
  import NotFound from './routes/not-found.svelte';
  import LoadingSpinner from './lib/components/LoadingSpinner.svelte';
  import UserMenu from './lib/components/user-menu.svelte';
  import { checkAuth, state as authState } from './lib/stores/auth.svelte';
  import { trackPageView } from './lib/analytics/gtag.js';

  const routes = {
    '/': Dashboard,
    '/event/:id': EventDetail,
    '/comparisons': Comparisons,
    '/compare/:id': ComparisonView,
    '/account': Account,
    '*': NotFound,
  };

  let sidebarCollapsed = $state(localStorage.getItem('sidebarCollapsed') === 'true');

  $effect(() => {
    localStorage.setItem('sidebarCollapsed', String(sidebarCollapsed));
  });

  // Check auth on app load
  $effect(() => {
    // Fire and forget
    checkAuth();
  });

  function toggleSidebar() {
    sidebarCollapsed = !sidebarCollapsed;
  }

  const currentLocation = $derived($location);
  const isDashboardActive = $derived(currentLocation === '/' || currentLocation === '');
  const isComparisonsActive = $derived(currentLocation.startsWith('/comparisons'));

  // Track page views when route changes (SPA)
  $effect(() => {
    const path = '/' + (currentLocation || '');
    trackPageView(path);
  });

  const sidebarWidth = $derived(sidebarCollapsed ? '4rem' : '16rem');
</script>

<div class="min-h-screen flex">
  <!-- Sidebar -->
  <nav
    class="fixed left-0 top-0 z-50 h-screen border-r border-border bg-surface backdrop-blur-xl transition-all duration-300"
    style="width: {sidebarWidth};"
  >
    <div class="flex h-full flex-col">
      <!-- Logo/Branding -->
      <div class="flex items-center gap-3 border-b border-border px-4 py-4">
        <span class="material-icons text-2xl text-text-primary">fitness_center</span>
        {#if !sidebarCollapsed}
          <h1 class="text-lg font-medium text-text-primary">OpenFitLab</h1>
        {/if}
      </div>

      {#if authState.authLoading}
        <div class="flex-1 grid place-items-center p-4">
          <LoadingSpinner />
        </div>
      {:else if !authState.user}
        <!-- When not authenticated, show only brand; user can use main area to login -->
        <div class="flex-1"></div>
      {:else}
        <!-- Navigation Items -->
        <div class="flex-1 py-4">
          <a
            href="#/"
            class="flex items-center gap-3 px-4 py-3 text-text-secondary transition-colors hover:bg-card-hover hover:text-text-primary {isDashboardActive
              ? 'bg-card-hover text-text-primary border-r-2 border-accent'
              : ''}"
          >
            <span class="material-icons">dashboard</span>
            {#if !sidebarCollapsed}
              <span>Dashboard</span>
            {/if}
          </a>
          <a
            href="#/comparisons"
            class="flex items-center gap-3 px-4 py-3 text-text-secondary transition-colors hover:bg-card-hover hover:text-text-primary {isComparisonsActive
              ? 'bg-card-hover text-text-primary border-r-2 border-accent'
              : ''}"
          >
            <span class="material-icons">compare_arrows</span>
            {#if !sidebarCollapsed}
              <span>Comparisons</span>
            {/if}
          </a>
        </div>

        <!-- User Menu -->
        <div class="border-t border-border">
          <UserMenu
            displayName={authState.user?.displayName ?? null}
            avatarUrl={authState.user?.avatarUrl ?? null}
            collapsed={sidebarCollapsed}
          />
        </div>
      {/if}

      <!-- Collapse Toggle -->
      <div class="border-t border-border p-4">
        <button
          type="button"
          class="flex w-full items-center gap-3 rounded px-4 py-2 text-text-secondary transition-colors hover:bg-card-hover hover:text-text-primary"
          onclick={toggleSidebar}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <span class="material-icons">{sidebarCollapsed ? 'chevron_right' : 'chevron_left'}</span>
          {#if !sidebarCollapsed}
            <span>Collapse</span>
          {/if}
        </button>
      </div>
    </div>
  </nav>

  <!-- Main Content -->
  <main class="flex-1 transition-all duration-300" style="margin-left: {sidebarWidth};">
    {#if authState.authLoading}
      <div class="grid place-items-center p-8">
        <LoadingSpinner />
      </div>
    {:else if !authState.user}
      <LoginPage />
    {:else}
      <Router {routes} />
    {/if}
  </main>
</div>
