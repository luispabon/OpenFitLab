<script lang="ts">
  import {
    fetchStravaStatus,
    fetchStravaActivities,
    importStravaActivities,
    type StravaActivityListItem,
  } from '../../api/strava';

  interface Props {
    open: boolean;
    onClose: () => void;
    /** Target folder for imported events (null = Unfiled). */
    folderId: string | null;
    onImported?: () => void;
  }
  let { open, onClose, folderId, onImported }: Props = $props();

  const STRAVA_CONNECT_IMG =
    'https://developers.strava.com/assets/api/btn_strava_connect_with_orange.svg';

  let panelEl = $state<HTMLDivElement | null>(null);
  let phase = $state<'idle' | 'loading' | 'list' | 'error'>('idle');
  let errorMessage = $state<string | null>(null);
  let configured = $state(true);
  let connected = $state(false);
  let activities = $state<StravaActivityListItem[]>([]);
  let listPage = $state(1);
  let listLoading = $state(false);
  let hasMore = $state(true);
  let importing = $state(false);
  let selectedIds = $state<Set<string>>(new Set());

  const perPage = 30;

  function formatDistanceM(meters: number | null): string {
    if (meters == null || Number.isNaN(meters)) return '—';
    if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`;
    return `${Math.round(meters)} m`;
  }

  function formatDurationSec(sec: number | null): string {
    if (sec == null || Number.isNaN(sec)) return '—';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function resetState() {
    phase = 'idle';
    errorMessage = null;
    activities = [];
    listPage = 1;
    hasMore = true;
    selectedIds = new Set();
    importing = false;
    listLoading = false;
  }

  async function loadInitial() {
    phase = 'loading';
    errorMessage = null;
    try {
      const status = await fetchStravaStatus();
      configured = status.configured;
      connected = status.connected === true;
      if (!status.configured) {
        phase = 'error';
        errorMessage = 'Strava is not configured on this server.';
        return;
      }
      if (!connected) {
        phase = 'list';
        return;
      }
      listPage = 1;
      activities = [];
      hasMore = true;
      await loadPage(1, true);
      phase = 'list';
    } catch (e) {
      phase = 'error';
      errorMessage = e instanceof Error ? e.message : 'Failed to load Strava';
    }
  }

  async function loadPage(page: number, replace: boolean) {
    listLoading = true;
    try {
      const { activities: rows } = await fetchStravaActivities({ page, perPage });
      if (replace) {
        activities = rows;
      } else {
        activities = [...activities, ...rows];
      }
      hasMore = rows.length >= perPage;
      listPage = page;
    } catch (e) {
      errorMessage = e instanceof Error ? e.message : 'Failed to load activities';
      if (e instanceof Error && /expired|reconnect|401/i.test(e.message)) {
        connected = false;
      }
    } finally {
      listLoading = false;
    }
  }

  $effect(() => {
    if (open) {
      resetState();
      void loadInitial();
    } else {
      resetState();
    }
  });

  $effect(() => {
    if (open && panelEl) {
      queueMicrotask(() => panelEl?.focus());
    }
  });

  function toggleSelected(id: string, row: StravaActivityListItem) {
    if (row.alreadyImported) return;
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selectedIds = next;
  }

  function onPanelKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  }

  async function runImport() {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    importing = true;
    errorMessage = null;
    try {
      const { results } = await importStravaActivities(ids, folderId);
      const failed = results.filter((r) => !r.success);
      const ok = results.filter((r) => r.success).length;
      if (ok > 0) {
        onImported?.();
        selectedIds = new Set();
        await loadPage(1, true);
      }
      if (failed.length > 0) {
        errorMessage = failed.map((f) => `${f.externalId}: ${f.error ?? 'Failed'}`).join('; ');
      }
    } catch (e) {
      errorMessage = e instanceof Error ? e.message : 'Import failed';
    } finally {
      importing = false;
    }
  }

  async function loadMore() {
    if (!listLoading && hasMore && connected) {
      await loadPage(listPage + 1, false);
    }
  }
</script>

{#if open}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    role="presentation"
    onclick={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}
  >
    <div
      bind:this={panelEl}
      role="dialog"
      aria-modal="true"
      aria-labelledby="strava-import-title"
      tabindex="-1"
      class="flex max-h-[min(90vh,720px)] w-full max-w-lg flex-col rounded-lg border border-border bg-surface shadow-xl outline-none"
      onkeydown={onPanelKeydown}
    >
      <div class="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 id="strava-import-title" class="text-lg font-semibold text-text-primary">
          Import from Strava
        </h2>
        <button
          type="button"
          class="rounded p-1 text-text-secondary hover:bg-card-hover hover:text-text-primary"
          aria-label="Close"
          onclick={() => onClose()}
        >
          <span class="material-icons text-xl">close</span>
        </button>
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {#if phase === 'loading'}
          <p class="text-sm text-text-secondary">Loading…</p>
        {:else if phase === 'error' && errorMessage}
          <p class="text-sm text-danger" role="alert">{errorMessage}</p>
        {:else if !connected}
          <p class="mb-4 text-sm text-text-secondary">
            Connect your Strava account to list and import activities. You will be redirected to
            Strava to authorize read access.
          </p>
          <a
            href="/api/integrations/strava/authorize"
            class="inline-block rounded focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <img
              src={STRAVA_CONNECT_IMG}
              width="193"
              height="48"
              alt="Connect with Strava"
              class="h-12 w-auto"
            />
          </a>
        {:else}
          {#if errorMessage}
            <p class="mb-2 text-sm text-amber-400" role="status">{errorMessage}</p>
          {/if}
          {#if activities.length === 0 && !listLoading}
            <p class="text-sm text-text-secondary">No activities found.</p>
          {:else}
            <ul class="space-y-1">
              {#each activities as row (row.id)}
                <li>
                  <label
                    class="flex cursor-pointer items-start gap-3 rounded-md px-2 py-2 hover:bg-card-hover {!row.alreadyImported
                      ? ''
                      : 'cursor-not-allowed opacity-60'}"
                  >
                    <input
                      type="checkbox"
                      class="mt-1"
                      checked={selectedIds.has(row.id)}
                      disabled={row.alreadyImported}
                      onchange={() => toggleSelected(row.id, row)}
                    />
                    <span class="min-w-0 flex-1">
                      <span class="block truncate font-medium text-text-primary">{row.name}</span>
                      <span class="text-xs text-text-secondary">
                        {new Date(row.startDate).toLocaleString()}
                        · {formatDistanceM(row.distance)}
                        · {formatDurationSec(row.movingTime)}
                        {#if row.sportType}
                          · {row.sportType}
                        {/if}
                      </span>
                      {#if row.alreadyImported}
                        <span
                          class="mt-0.5 inline-block rounded bg-text-secondary/20 px-1.5 py-0.5 text-xs text-text-secondary"
                        >
                          Imported
                        </span>
                      {/if}
                    </span>
                  </label>
                </li>
              {/each}
            </ul>
          {/if}
          {#if hasMore && activities.length > 0}
            <button
              type="button"
              class="mt-3 w-full rounded border border-border py-2 text-sm text-text-primary hover:bg-card-hover disabled:opacity-50"
              disabled={listLoading}
              onclick={() => loadMore()}
            >
              {listLoading ? 'Loading…' : 'Load more'}
            </button>
          {/if}
        {/if}
      </div>

      {#if connected && activities.length > 0}
        <div class="border-t border-border px-4 py-3">
          <button
            type="button"
            class="w-full rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
            disabled={importing || selectedIds.size === 0}
            onclick={() => runImport()}
          >
            {importing ? 'Importing…' : `Import selected (${selectedIds.size})`}
          </button>
        </div>
      {/if}

      {#if configured}
        <div class="border-t border-border px-4 py-2 text-center">
          <a
            href="https://www.strava.com"
            target="_blank"
            rel="noopener noreferrer"
            class="text-xs font-semibold text-[#FC5200] underline"
          >
            Powered by Strava
          </a>
        </div>
      {/if}
    </div>
  </div>
{/if}
