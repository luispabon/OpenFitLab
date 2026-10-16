<script lang="ts">
  import type { ActivityRow } from '../../types';
  import {
    getActivityIcon,
    getActivityIconColor,
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
    onDragStart?: (row: ActivityRow, e: DragEvent) => void;
    onDragEnd?: () => void;
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
    onDragStart,
    onDragEnd,
  }: Props = $props();

  let draggingEventId = $state<string | null>(null);
</script>

<div class="overflow-hidden rounded-lg border border-border bg-card">
  <table class="w-full table-fixed divide-y divide-border text-[1.00625rem]">
    <thead class="bg-surface">
      <tr>
        <th scope="col" class="relative w-12 px-3 py-3">
          <input
            type="checkbox"
            bind:this={selectAllCheckbox}
            class="h-4 w-4 rounded border-border text-accent-text focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-transparent"
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
        <th scope="col" class="relative w-44 px-3 py-3">
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
            draggable="true"
            class="hover:bg-card-hover"
            class:cursor-pointer={!isLoading}
            class:bg-card-hover={isSelected}
            class:opacity-50={draggingEventId === row.event.id}
            onclick={() => {
              if (!isLoading) onRowClick(row.event.id);
            }}
            onkeydown={(e) => {
              if (!isLoading && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                onRowClick(row.event.id);
              }
            }}
            ondragstart={(e) => {
              draggingEventId = row.event.id;
              onDragStart?.(row, e);
            }}
            ondragend={() => {
              draggingEventId = null;
              onDragEnd?.();
            }}
          >
            <td class="px-3 py-4" onclick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                class="h-4 w-4 rounded border-border text-accent-text focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-transparent"
                checked={isSelected}
                onchange={() => onToggleEventSelection(row.event.id)}
                aria-label={`Select event ${row.event.name || row.event.id}`}
                onclick={(e) => e.stopPropagation()}
              />
            </td>
            <td class="px-3 py-4">
              <div class="flex min-w-0 items-center gap-2">
                <!-- Centre via this wrapper: .material-icons (unlayered) forces display:inline-block on the glyph span. -->
                <div
                  class="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-card-hover"
                >
                  <span
                    class="material-icons {getActivityIconColor(row.activity.type)}"
                    aria-hidden="true">{getActivityIcon(row.activity.type)}</span
                  >
                </div>
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
            <td class="whitespace-nowrap px-3 py-4 font-mono tabular-nums text-text-primary">
              {formatDurationCell(row.activity.stats)}
            </td>
            <td class="whitespace-nowrap px-3 py-4 font-mono tabular-nums text-text-primary">
              {formatAvgHeartRateCell(row.activity.stats)}
            </td>
            <td class="whitespace-nowrap px-3 py-4 font-mono tabular-nums text-text-primary">
              {formatCaloriesCell(row.activity.stats)}
            </td>
            <td class="whitespace-nowrap px-3 py-4 font-mono tabular-nums text-text-primary">
              {formatDistanceCell(row.activity.stats)}
            </td>
            <td class="whitespace-nowrap px-3 py-4 text-sm tabular-nums text-text-secondary">
              {formatDateWithOriginalTimezone(
                row.activity.startDate ?? row.event.startDate,
                row.activity.startTimezone ?? row.event.startTimezone
              )}
            </td>
            <td class="px-3 py-4 text-right font-medium whitespace-nowrap">
              <div class="flex items-center justify-end gap-1">
                <button
                  type="button"
                  class="inline-flex h-8 w-8 items-center justify-center rounded-md border-0 bg-transparent text-text-secondary hover:bg-card-hover hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-transparent"
                  title="View activity"
                  aria-label="View"
                  onclick={(e) => {
                    e.stopPropagation();
                    onViewClick(row.event.id, e);
                  }}
                >
                  <span class="material-icons text-base leading-none" aria-hidden="true"
                    >visibility</span
                  >
                </button>
                <button
                  type="button"
                  class="inline-flex h-8 w-8 items-center justify-center rounded-md border-0 bg-transparent text-text-secondary hover:bg-card-hover hover:text-accent-text focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-transparent"
                  title="Find comparisons"
                  aria-label="Find comparisons"
                  onclick={(e) => {
                    e.stopPropagation();
                    onFindComparisonsClick(row.event.id);
                  }}
                >
                  <span class="material-icons text-base leading-none" aria-hidden="true"
                    >compare</span
                  >
                </button>
                <button
                  type="button"
                  class="inline-flex h-8 w-8 items-center justify-center rounded-md border-0 bg-transparent text-text-secondary hover:bg-card-hover hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-transparent"
                  title="Move to folder"
                  aria-label="Move to folder"
                  onclick={(e) => onMoveClick(row.event.id, e)}
                >
                  <span class="material-icons text-base leading-none" aria-hidden="true"
                    >folder_open</span
                  >
                </button>
                <button
                  type="button"
                  class="inline-flex h-8 w-8 items-center justify-center rounded-md border-0 bg-transparent text-text-secondary hover:bg-card-hover hover:text-danger focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-transparent"
                  title="Delete activity"
                  aria-label="Delete"
                  onclick={(e) => onDeleteClick(row.event.id, e)}
                >
                  <span class="material-icons text-base leading-none" aria-hidden="true"
                    >delete</span
                  >
                </button>
              </div>
            </td>
          </tr>
        {/each}
      {/if}
    </tbody>
  </table>
</div>
