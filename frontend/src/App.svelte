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
  import UserMenu from './lib/components/user-menu.svelte';
  import Footer from './lib/components/Footer.svelte';
  import { checkAuth, state as authState } from './lib/stores/auth.svelte';
  import {
    loadFolders,
    foldersState,
    getFolderFromHash,
    buildFolderHash,
    setFolderHash,
  } from './lib/stores/folders.svelte';
  import { trackPageView } from './lib/analytics/gtag.js';
  import { FOLDER_SELECTION_ALL, FOLDER_SELECTION_UNFILED } from './lib/types/event';
  import type { Folder } from './lib/types/event';
  import { updateFolder } from './lib/api/folders';
  import FolderCreateModal from './lib/components/folders/FolderCreateModal.svelte';
  import FolderRenameModal from './lib/components/folders/FolderRenameModal.svelte';
  import FolderColorModal from './lib/components/folders/FolderColorModal.svelte';
  import FolderDeleteModal from './lib/components/folders/FolderDeleteModal.svelte';
  import FolderContextMenu from './lib/components/folders/FolderContextMenu.svelte';

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
    '*': NotFound,
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
  const folderList = $derived(foldersState.folders);
  const pinnedFolders = $derived(
    [...folderList].filter((f) => f.pinned).sort((a, b) => a.name.localeCompare(b.name))
  );
  const unpinnedFolders = $derived(
    [...folderList].filter((f) => !f.pinned).sort((a, b) => a.name.localeCompare(b.name))
  );

  function isFolderActive(
    value: typeof FOLDER_SELECTION_ALL | typeof FOLDER_SELECTION_UNFILED | string
  ): boolean {
    return activeFolderValue === value;
  }

  const pinnedCount = $derived(folderList.filter((f) => f.pinned).length);
  const MAX_FOLDERS = 20;
  const MAX_PINNED = 5;

  let showCreateFolderModal = $state(false);
  let newFolderBtnEl = $state<HTMLElement | null>(null);
  let folderToRename = $state<Folder | null>(null);
  let folderToRecolor = $state<Folder | null>(null);
  let folderToDelete = $state<Folder | null>(null);
  let folderMenuFolder = $state<Folder | null>(null);
  let menuAnchorEl = $state<HTMLElement | null>(null);
  let folderToastMessage = $state<string | null>(null);

  function showFolderToast(message: string) {
    folderToastMessage = message;
    setTimeout(() => {
      folderToastMessage = null;
    }, 4000);
  }

  async function handleFolderPinToggle(folder: Folder) {
    try {
      await updateFolder(folder.id, { pinned: !folder.pinned });
      loadFolders();
    } catch (error) {
      showFolderToast(error instanceof Error ? error.message : 'Failed to update folder');
    }
  }

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
        <div class="flex-1 py-4 overflow-y-auto">
          <div class="flex items-center">
            <a
              href="#/"
              class="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-text-secondary transition-colors hover:bg-card-hover hover:text-text-primary {isWorkoutsActive
                ? 'bg-card-hover text-text-primary border-r-2 border-accent'
                : ''}"
            >
              <span class="material-icons">dashboard</span>
              {#if !sidebarCollapsed}
                <span>Workouts</span>
              {/if}
            </a>
            {#if !sidebarCollapsed}
              <button
                bind:this={newFolderBtnEl}
                type="button"
                class="rounded p-1.5 text-text-secondary transition-colors hover:bg-card-hover hover:text-text-primary"
                aria-label="New folder"
                onclick={() => (showCreateFolderModal = true)}
              >
                <span class="material-icons text-base">create_new_folder</span>
              </button>
            {/if}
          </div>
          {#if !sidebarCollapsed}
            <div class="mt-1 pl-11">
              <div class="flex items-center gap-0.5 py-0.5">
                <a
                  href={buildFolderHash(FOLDER_SELECTION_ALL)}
                  class="flex min-w-0 flex-1 items-center gap-2 py-2 pr-0 text-sm text-text-secondary transition-colors hover:text-text-primary {isFolderActive(
                    FOLDER_SELECTION_ALL
                  )
                    ? 'bg-card-hover text-text-primary border-r-2 border-accent'
                    : ''}"
                >
                  <span class="relative flex h-6 w-3 shrink-0 items-stretch" aria-hidden="true">
                    <span class="absolute left-0 top-0 bottom-1/2 w-px bg-white"></span>
                    <span class="absolute left-0 right-0 top-1/2 h-px bg-white"></span>
                  </span>
                  <span class="material-icons text-base shrink-0">folder_open</span>
                  <span>All</span>
                </a>
              </div>
              <div class="flex items-center gap-0.5 py-0.5">
                <a
                  href={buildFolderHash(FOLDER_SELECTION_UNFILED)}
                  class="flex min-w-0 flex-1 items-center gap-2 py-2 pr-0 text-sm text-text-secondary transition-colors hover:text-text-primary {isFolderActive(
                    FOLDER_SELECTION_UNFILED
                  )
                    ? 'bg-card-hover text-text-primary border-r-2 border-accent'
                    : ''}"
                >
                  <span class="relative flex h-6 w-3 shrink-0 items-stretch" aria-hidden="true">
                    <span class="absolute left-0 top-0 bottom-1/2 w-px bg-white"></span>
                    <span class="absolute left-0 right-0 top-1/2 h-px bg-white"></span>
                  </span>
                  <span class="material-icons text-base shrink-0">folder_off</span>
                  <span>Unfiled</span>
                </a>
              </div>
              {#each pinnedFolders as folder (folder.id)}
                <div class="flex items-center gap-0.5 py-0.5">
                  <a
                    href={buildFolderHash(folder.id)}
                    class="flex min-w-0 flex-1 items-center gap-2 py-2 pr-0 text-sm text-text-secondary transition-colors hover:text-text-primary {isFolderActive(
                      folder.id
                    )
                      ? 'bg-card-hover text-text-primary border-r-2 border-accent'
                      : ''}"
                  >
                    <span class="relative flex h-6 w-3 shrink-0 items-stretch" aria-hidden="true">
                      <span class="absolute left-0 top-0 bottom-1/2 w-px bg-white"></span>
                      <span class="absolute left-0 right-0 top-1/2 h-px bg-white"></span>
                    </span>
                    <span
                      class="material-icons text-base shrink-0"
                      style="color: {folder.color};"
                      aria-hidden="true">folder</span
                    >
                    <span class="truncate">{folder.name}</span>
                    <span class="material-icons text-base text-amber-500" title="Pinned"
                      >push_pin</span
                    >
                  </a>
                  <button
                    type="button"
                    class="rounded p-1 text-text-secondary hover:bg-card-hover hover:text-text-primary"
                    aria-label="Folder options for {folder.name}"
                    onclick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      folderMenuFolder = folder;
                      menuAnchorEl = e.currentTarget as HTMLElement;
                    }}
                  >
                    <span class="material-icons text-base">more_vert</span>
                  </button>
                </div>
              {/each}
              {#each unpinnedFolders as folder (folder.id)}
                <div class="flex items-center gap-0.5 py-0.5">
                  <a
                    href={buildFolderHash(folder.id)}
                    class="flex min-w-0 flex-1 items-center gap-2 py-2 pr-0 text-sm text-text-secondary transition-colors hover:text-text-primary {isFolderActive(
                      folder.id
                    )
                      ? 'bg-card-hover text-text-primary border-r-2 border-accent'
                      : ''}"
                  >
                    <span class="relative flex h-6 w-3 shrink-0 items-stretch" aria-hidden="true">
                      <span class="absolute left-0 top-0 bottom-1/2 w-px bg-white"></span>
                      <span class="absolute left-0 right-0 top-1/2 h-px bg-white"></span>
                    </span>
                    <span
                      class="material-icons text-base shrink-0"
                      style="color: {folder.color};"
                      aria-hidden="true">folder</span
                    >
                    <span class="truncate">{folder.name}</span>
                  </a>
                  <button
                    type="button"
                    class="rounded p-1 text-text-secondary hover:bg-card-hover hover:text-text-primary"
                    aria-label="Folder options for {folder.name}"
                    onclick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      folderMenuFolder = folder;
                      menuAnchorEl = e.currentTarget as HTMLElement;
                    }}
                  >
                    <span class="material-icons text-base">more_vert</span>
                  </button>
                </div>
              {/each}
            </div>
          {/if}
          <a
            href="#/comparisons"
            class="flex items-center gap-3 px-4 py-3 mt-2 text-text-secondary transition-colors hover:bg-card-hover hover:text-text-primary {isComparisonsActive
              ? 'bg-card-hover text-text-primary border-r-2 border-accent'
              : ''}"
          >
            <span class="material-icons">compare_arrows</span>
            {#if !sidebarCollapsed}
              <span>Comparisons</span>
            {/if}
          </a>
        </div>

        <!-- Folder modals and context menu -->
        {#if folderMenuFolder && menuAnchorEl}
          <FolderContextMenu
            folder={folderMenuFolder}
            {pinnedCount}
            maxPinned={MAX_PINNED}
            anchor={menuAnchorEl}
            onRename={() => {
              folderToRename = folderMenuFolder;
              folderMenuFolder = null;
              menuAnchorEl = null;
            }}
            onRecolor={() => {
              folderToRecolor = folderMenuFolder;
              folderMenuFolder = null;
              menuAnchorEl = null;
            }}
            onPinToggle={handleFolderPinToggle}
            onDelete={() => {
              folderToDelete = folderMenuFolder;
              folderMenuFolder = null;
              menuAnchorEl = null;
            }}
            onClose={() => {
              folderMenuFolder = null;
              menuAnchorEl = null;
            }}
          />
        {/if}
        <FolderCreateModal
          open={showCreateFolderModal}
          anchorEl={newFolderBtnEl}
          existingNames={folderList.map((f) => f.name)}
          maxFolders={MAX_FOLDERS}
          onCreated={() => {
            loadFolders();
          }}
          onClosed={() => (showCreateFolderModal = false)}
          onError={showFolderToast}
        />
        <FolderRenameModal
          folder={folderToRename}
          existingNames={folderList.map((f) => f.name)}
          onDone={loadFolders}
          onClosed={() => (folderToRename = null)}
          onError={showFolderToast}
        />
        <FolderColorModal
          folder={folderToRecolor}
          onDone={loadFolders}
          onClosed={() => (folderToRecolor = null)}
          onError={showFolderToast}
        />
        <FolderDeleteModal
          folder={folderToDelete}
          onDone={loadFolders}
          onClosed={() => (folderToDelete = null)}
          onError={showFolderToast}
        />
        {#if folderToastMessage}
          <div
            class="fixed bottom-20 left-4 z-50 rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary shadow-lg"
            role="alert"
          >
            {folderToastMessage}
          </div>
        {/if}

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
  <main
    class="flex flex-1 flex-col transition-all duration-300"
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
