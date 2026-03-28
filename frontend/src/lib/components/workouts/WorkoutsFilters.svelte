<script lang="ts">
  import type { Folder } from '../../types/event';

  interface Props {
    searchInputValue?: string;
    onSearchInput: () => void;
    activityTypesOptions: string[];
    selectedActivityTypes: string[];
    onToggleActivityType: (type: string) => void;
    devicesOptions: string[];
    selectedDevices: string[];
    onToggleDevice: (device: string) => void;
    dateStartStr: string;
    dateEndStr: string;
    onDateStartChange: (value: string) => void;
    onDateEndChange: (value: string) => void;
    /** Pinned first (name), then unpinned (name) — same as sidebar. */
    navFolders: Folder[];
    activeFolderId: string;
    /** When hash references a folder id not in `navFolders`, show this option so the select stays valid. */
    orphanFolderId: string | null;
    onFolderChange: (folderId: string) => void;
  }
  let {
    searchInputValue = $bindable(''),
    onSearchInput,
    activityTypesOptions,
    selectedActivityTypes,
    onToggleActivityType,
    devicesOptions,
    selectedDevices,
    onToggleDevice,
    dateStartStr,
    dateEndStr,
    onDateStartChange,
    onDateEndChange,
    navFolders,
    activeFolderId,
    orphanFolderId,
    onFolderChange,
  }: Props = $props();

  let activityTypeDropdownOpen = $state(false);
  let deviceDropdownOpen = $state(false);
  let activityTypeFilter = $state('');
  let activityTypeFilterInputEl = $state<HTMLInputElement | null>(null);

  const filteredActivityTypes = $derived.by(() => {
    const q = activityTypeFilter.trim().toLowerCase();
    if (!q) return activityTypesOptions;
    return activityTypesOptions.filter((t) => t.toLowerCase().includes(q));
  });

  function openActivityTypeDropdown() {
    deviceDropdownOpen = false;
    if (!activityTypeDropdownOpen) activityTypeFilter = '';
    activityTypeDropdownOpen = !activityTypeDropdownOpen;
  }

  function openDeviceDropdown() {
    deviceDropdownOpen = !deviceDropdownOpen;
    activityTypeDropdownOpen = false;
  }

  function closeDropdowns() {
    activityTypeFilter = '';
    activityTypeDropdownOpen = false;
    deviceDropdownOpen = false;
  }

  $effect(() => {
    if (!activityTypeDropdownOpen && !deviceDropdownOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDropdowns();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  $effect(() => {
    if (activityTypeDropdownOpen && activityTypeFilterInputEl) {
      const t = setTimeout(() => activityTypeFilterInputEl?.focus(), 0);
      return () => clearTimeout(t);
    }
  });
</script>

<div
  class="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3 backdrop-blur"
  class:relative={activityTypeDropdownOpen || deviceDropdownOpen}
  class:z-30={activityTypeDropdownOpen || deviceDropdownOpen}
>
  <div class="flex min-w-0 flex-1 flex-wrap items-center gap-3">
    <label class="sr-only" for="filter-search">Search</label>
    <input
      id="filter-search"
      type="text"
      bind:value={searchInputValue}
      oninput={onSearchInput}
      placeholder="Search…"
      class="min-w-[12rem] rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text-primary placeholder:text-text-secondary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
    />
    <div class="relative">
      <button
        type="button"
        onclick={openActivityTypeDropdown}
        class="inline-flex items-center rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text-primary hover:bg-card-hover focus:outline-none focus:ring-1 focus:ring-accent"
        aria-expanded={activityTypeDropdownOpen}
        aria-haspopup="listbox"
      >
        Activity type {selectedActivityTypes.length ? `(${selectedActivityTypes.length})` : ''}
        <span class="material-icons ml-1 text-sm">arrow_drop_down</span>
      </button>
      {#if activityTypeDropdownOpen}
        <div
          class="absolute left-0 top-full z-20 mt-1 w-56 rounded-md border border-border bg-card-solid shadow-lg"
          role="listbox"
        >
          <div class="sticky top-0 z-10 border-b border-border bg-card-solid p-2">
            <label for="activity-type-filter" class="sr-only">Filter activity types</label>
            <input
              id="activity-type-filter"
              type="text"
              bind:value={activityTypeFilter}
              placeholder="Search…"
              class="w-full rounded border border-border bg-surface px-2 py-1.5 text-sm text-text-primary placeholder:text-text-secondary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              onkeydown={(e) => e.stopPropagation()}
              bind:this={activityTypeFilterInputEl}
            />
          </div>
          <div class="max-h-60 overflow-auto py-1">
            {#each filteredActivityTypes as type}
              <label class="flex cursor-pointer items-center gap-2 px-3 py-1.5 hover:bg-card-hover">
                <input
                  type="checkbox"
                  checked={selectedActivityTypes.includes(type)}
                  onchange={() => onToggleActivityType(type)}
                  class="h-4 w-4 rounded border-border text-accent"
                />
                <span class="text-sm text-text-primary">{type}</span>
              </label>
            {/each}
            {#if filteredActivityTypes.length === 0}
              <p class="px-3 py-2 text-sm text-text-secondary">No matching types</p>
            {/if}
          </div>
        </div>
      {/if}
    </div>
    <div class="relative">
      <button
        type="button"
        onclick={openDeviceDropdown}
        class="inline-flex items-center rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text-primary hover:bg-card-hover focus:outline-none focus:ring-1 focus:ring-accent"
        aria-expanded={deviceDropdownOpen}
        aria-haspopup="listbox"
      >
        Device {selectedDevices.length ? `(${selectedDevices.length})` : ''}
        <span class="material-icons ml-1 text-sm">arrow_drop_down</span>
      </button>
      {#if deviceDropdownOpen}
        <div
          class="absolute left-0 top-full z-20 mt-1 max-h-60 w-56 overflow-auto rounded-md border border-border bg-card-solid py-1 shadow-lg"
          role="listbox"
        >
          {#each devicesOptions as device}
            <label class="flex cursor-pointer items-center gap-2 px-3 py-1.5 hover:bg-card-hover">
              <input
                type="checkbox"
                checked={selectedDevices.includes(device)}
                onchange={() => onToggleDevice(device)}
                class="h-4 w-4 rounded border-border text-accent"
              />
              <span class="text-sm text-text-primary">{device}</span>
            </label>
          {/each}
        </div>
      {/if}
    </div>
    {#if activityTypeDropdownOpen || deviceDropdownOpen}
      <div class="fixed inset-0 z-10" role="presentation" onclick={closeDropdowns}></div>
    {/if}
    <div class="flex items-center gap-2">
      <label for="filter-date-start" class="text-sm text-text-secondary">From</label>
      <input
        id="filter-date-start"
        type="date"
        value={dateStartStr}
        onchange={(e) => onDateStartChange((e.target as HTMLInputElement).value)}
        class="rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
      />
      <label for="filter-date-end" class="text-sm text-text-secondary">To</label>
      <input
        id="filter-date-end"
        type="date"
        value={dateEndStr}
        onchange={(e) => onDateEndChange((e.target as HTMLInputElement).value)}
        class="rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
      />
    </div>
  </div>

  <div class="ml-auto flex shrink-0 items-center gap-2">
    <label for="filter-folder" class="text-sm text-text-secondary whitespace-nowrap">Folder</label>
    <select
      id="filter-folder"
      class="max-w-[14rem] rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
      value={activeFolderId}
      onchange={(e) => onFolderChange((e.target as HTMLSelectElement).value)}
    >
      <option value="all">All</option>
      <option value="unfiled">Unfiled</option>
      {#if orphanFolderId}
        <option value={orphanFolderId}>Unknown folder</option>
      {/if}
      {#each navFolders as folder (folder.id)}
        <option value={folder.id}>{folder.name}</option>
      {/each}
    </select>
  </div>
</div>
