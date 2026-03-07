<script lang="ts">
  import type { ActivityRow } from '../../types';
  import {
    getActivityIcon,
    getActivityDeviceName,
    formatDateWithOriginalTimezone,
  } from '../../utils';

  interface Props {
    rows: ActivityRow[];
    isLoading: boolean;
    selectedEventIds: Set<string>;
    uniqueEventIds: string[];
    selectAllChecked: boolean;
    selectAllIndeterminate: boolean;
    selectAllCheckbox?: HTMLInputElement | null;
    formatDurationCell: (stats: Record<string, unknown>) => string;
    formatAvgHeartRateCell: (stats: Record<string, unknown>) => string;
    formatCaloriesCell: (stats: Record<string, unknown>) => string;
    formatDistanceCell: (stats: Record<string, unknown>) => string;
    onSelectAllChange: () => void;
    onRowClick: (eventId: string) => void;
    onToggleEventSelection: (eventId: string) => void;
    onViewClick: (eventId: string, e: MouseEvent) => void;
    onFindComparisonsClick: (eventId: string) => void;
    onMoveClick: (eventId: string, e: MouseEvent) => void;
    onDeleteClick: (eventId: string, e: MouseEvent) => void;
  }
  let {
    rows,
    isLoading,
    selectedEventIds,
    uniqueEventIds: _uniqueEventIds,
    selectAllChecked,
    selectAllIndeterminate: _selectAllIndeterminate,
    selectAllCheckbox = $bindable(null as HTMLInputElement | null),
    formatDurationCell,
    formatAvgHeartRateCell,
    formatCaloriesCell,
    formatDistanceCell,
    onSelectAllChange,
    onRowClick,
    onToggleEventSelection,
    onViewClick,
    onFindComparisonsClick,
    onMoveClick,
    onDeleteClick,
  }: Props = $props();
</script>

<div class="overflow-hidden rounded-lg border border-border bg-card shadow backdrop-blur-lg">
  <table class="w-full table-fixed divide-y divide-border text-[1.00625rem]">
    <thead class="bg-surface">
      <tr>
        <th scope="col" class="relative w-12 px-3 py-3">
          <input
            type="checkbox"
            bind:this={selectAllCheckbox}
            class="h-4 w-4 rounded border-border text-accent focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-transparent"
            checked={selectAllChecked}
            onchange={onSelectAllChange}
            aria-label="Select all events"
          />
        </th>
        <th
          scope="col"
          class="w-1/4 px-3 py-3 text-left text-[0.8625rem] font-medium uppercase tracking-wider text-text-secondary"
        >
          Activity
        </th>
        <th
          scope="col"
          class="w-20 px-3 py-3 text-left text-[0.8625rem] font-medium uppercase tracking-wider text-text-secondary"
        >
          Duration
        </th>
        <th
          scope="col"
          class="w-24 px-3 py-3 text-left text-[0.8625rem] font-medium uppercase tracking-wider text-text-secondary"
        >
          Avg HR
        </th>
        <th
          scope="col"
          class="w-20 px-3 py-3 text-left text-[0.8625rem] font-medium uppercase tracking-wider text-text-secondary"
        >
          Calories
        </th>
        <th
          scope="col"
          class="w-24 px-3 py-3 text-left text-[0.8625rem] font-medium uppercase tracking-wider text-text-secondary"
        >
          Distance
        </th>
        <th
          scope="col"
          class="w-32 px-3 py-3 text-left text-[0.8625rem] font-medium uppercase tracking-wider text-text-secondary"
        >
          Date
        </th>
        <th scope="col" class="relative w-48 px-3 py-3">
          <span class="sr-only">Actions</span>
        </th>
      </tr>
    </thead>
    <tbody class="divide-y divide-border bg-transparent">
      {#if rows.length === 0 && !isLoading}
        <tr>
          <td colspan="8" class="px-6 py-4 text-center text-text-secondary">
            No activities found. Upload an activity file or adjust filters.
          </td>
        </tr>
      {:else}
        {#each rows as row (`${row.event.id}_${row.activity.id}`)}
          {@const isSelected = selectedEventIds.has(row.event.id)}
          <tr
            role="link"
            tabindex="0"
            class="hover:bg-card-hover"
            class:cursor-pointer={!isLoading}
            class:bg-card-hover={isSelected}
            onclick={() => {
              if (!isLoading) onRowClick(row.event.id);
            }}
            onkeydown={(e) => {
              if (!isLoading && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                onRowClick(row.event.id);
              }
            }}
          >
            <td class="px-3 py-4" onclick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                class="h-4 w-4 rounded border-border text-accent focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-transparent"
                checked={isSelected}
                onchange={() => onToggleEventSelection(row.event.id)}
                aria-label={`Select event ${row.event.name || row.event.id}`}
                onclick={(e) => e.stopPropagation()}
              />
            </td>
            <td class="px-3 py-4">
              <div class="flex min-w-0 items-center gap-2">
                <span
                  class="material-icons inline-flex h-12 w-12 shrink-0 items-center justify-center text-[3rem] leading-none text-text-secondary"
                  aria-hidden="true">{getActivityIcon(row.activity.type)}</span
                >
                <div class="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span class="truncate font-medium text-text-primary"
                    >{row.activity.type || '—'}</span
                  >
                  <span class="truncate text-sm text-text-secondary">
                    {getActivityDeviceName(row.activity)}
                  </span>
                  <span
                    class="truncate text-sm text-text-secondary"
                    title={row.event.name || undefined}
                  >
                    {row.event.name || '—'}
                  </span>
                </div>
              </div>
            </td>
            <td class="whitespace-nowrap px-3 py-4 text-text-secondary">
              {formatDurationCell(row.activity.stats)}
            </td>
            <td class="whitespace-nowrap px-3 py-4 text-text-secondary">
              {formatAvgHeartRateCell(row.activity.stats)}
            </td>
            <td class="whitespace-nowrap px-3 py-4 text-text-secondary">
              {formatCaloriesCell(row.activity.stats)}
            </td>
            <td class="whitespace-nowrap px-3 py-4 text-text-secondary">
              {formatDistanceCell(row.activity.stats)}
            </td>
            <td class="whitespace-nowrap px-3 py-4 text-sm text-text-secondary">
              {formatDateWithOriginalTimezone(
                row.activity.startDate ?? row.event.startDate,
                row.activity.startTimezone ?? row.event.startTimezone
              )}
            </td>
            <td class="px-3 py-4 text-right font-medium">
              <div class="flex flex-wrap items-center justify-end gap-1.5">
                <button
                  type="button"
                  class="inline-flex h-8 items-center justify-center gap-1 rounded-md border border-border bg-card px-2 text-xs font-medium text-text-primary shadow-sm hover:bg-card-hover focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-transparent"
                  onclick={(e) => {
                    e.stopPropagation();
                    onViewClick(row.event.id, e);
                  }}
                >
                  <span class="material-icons text-base leading-none" aria-hidden="true"
                    >search</span
                  >
                  View
                </button>
                <button
                  type="button"
                  class="inline-flex h-8 items-center justify-center gap-1 rounded-md border border-accent/30 bg-card px-2 text-xs font-medium text-accent shadow-sm hover:bg-accent/10 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-transparent"
                  onclick={(e) => {
                    e.stopPropagation();
                    onFindComparisonsClick(row.event.id);
                  }}
                >
                  <span class="material-icons text-base leading-none" aria-hidden="true"
                    >compare_arrows</span
                  >
                  Find
                </button>
                <button
                  type="button"
                  class="inline-flex h-8 items-center justify-center gap-1 rounded-md border border-border bg-card px-2 text-xs font-medium text-text-primary shadow-sm hover:bg-card-hover focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-transparent"
                  onclick={(e) => onMoveClick(row.event.id, e)}
                  title="Move to folder"
                >
                  <span class="material-icons text-base leading-none" aria-hidden="true"
                    >drive_file_move</span
                  >
                  Move
                </button>
                <button
                  type="button"
                  class="inline-flex h-8 items-center justify-center gap-1 rounded-md border border-danger/30 bg-card px-2 text-xs font-medium text-danger shadow-sm hover:bg-danger/10 focus:outline-none focus:ring-2 focus:ring-danger focus:ring-offset-2 focus:ring-offset-transparent"
                  onclick={(e) => onDeleteClick(row.event.id, e)}
                >
                  <span class="material-icons text-base leading-none" aria-hidden="true"
                    >delete</span
                  >
                  Delete
                </button>
              </div>
            </td>
          </tr>
        {/each}
      {/if}
    </tbody>
  </table>
</div>
