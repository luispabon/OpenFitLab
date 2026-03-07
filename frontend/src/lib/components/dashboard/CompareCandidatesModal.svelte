<script lang="ts">
  import type { ActivityRow, EventSummary } from '../../types';
  import { getActivityIcon, getActivityDeviceName, formatDateWithTime } from '../../utils';
  import LoadingSpinner from '../LoadingSpinner.svelte';

  interface Props {
    open: boolean;
    sourceEventRow: ActivityRow | null;
    candidates: EventSummary[];
    candidatesLoading: boolean;
    selectedCandidateIds: Set<string>;
    showAllFolders?: boolean;
    onToggleShowAllFolders?: () => void;
    onToggleCandidate: (eventId: string) => void;
    onCompare: () => void;
    onCancel: () => void;
  }
  let {
    open,
    sourceEventRow,
    candidates,
    candidatesLoading,
    selectedCandidateIds,
    showAllFolders = false,
    onToggleShowAllFolders,
    onToggleCandidate,
    onCompare,
    onCancel,
  }: Props = $props();

  let dialogRef: HTMLDivElement | undefined = $state();

  $effect(() => {
    if (!open || !dialogRef) return;
    const id = requestAnimationFrame(() => {
      dialogRef?.focus();
    });
    return () => cancelAnimationFrame(id);
  });
</script>

{#if open}
  <div
    bind:this={dialogRef}
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    role="dialog"
    aria-modal="true"
    tabindex="-1"
    onclick={onCancel}
    onkeydown={(e) => {
      if (e.key === 'Escape') onCancel();
    }}
  >
    <div
      class="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-xl backdrop-blur-xl"
      role="presentation"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => {
        if (e.key === 'Escape') {
          onCancel();
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        e.stopPropagation();
      }}
    >
      <div class="flex items-center justify-between border-b border-border p-6">
        <div class="flex-1">
          <h2 class="mb-3 text-lg font-semibold text-text-primary">Find Comparison Candidates</h2>
          {#if sourceEventRow}
            <div class="flex items-center gap-3">
              <span
                class="material-icons inline-flex h-10 w-10 shrink-0 items-center justify-center text-[2.5rem] leading-none text-text-secondary"
                aria-hidden="true">{getActivityIcon(sourceEventRow.activity.type)}</span
              >
              <div class="min-w-0 flex flex-col gap-0.5">
                <span class="font-medium text-text-primary"
                  >{sourceEventRow.activity.type || '—'}</span
                >
                <span class="text-sm text-text-secondary">
                  {getActivityDeviceName(sourceEventRow.activity)}
                </span>
                <span
                  class="truncate text-sm text-text-secondary"
                  title={sourceEventRow.event.name || undefined}
                >
                  {sourceEventRow.event.name || '—'}
                </span>
                <span class="text-sm text-text-secondary">
                  {formatDateWithTime(
                    sourceEventRow.activity.startDate ?? sourceEventRow.event.startDate
                  )}
                </span>
              </div>
            </div>
          {/if}
        </div>
        <button
          type="button"
          class="ml-4 rounded p-1 text-text-secondary hover:bg-card-hover hover:text-text-primary"
          onclick={onCancel}
          aria-label="Close"
        >
          <span class="material-icons">close</span>
        </button>
      </div>

      <div class="flex-1 overflow-y-auto p-6">
        {#if candidatesLoading}
          <div class="flex justify-center py-8">
            <LoadingSpinner />
          </div>
        {:else if candidates.length === 0}
          <p class="py-8 text-center text-sm text-text-secondary">
            No overlapping events found for comparison.
          </p>
        {:else}
          <p class="mb-2 text-sm text-text-secondary">
            Select events that overlap in time with this event to compare:
          </p>
          {#if onToggleShowAllFolders}
            <p class="mb-4">
              <button
                type="button"
                class="text-sm font-medium text-accent hover:underline"
                onclick={onToggleShowAllFolders}
              >
                {showAllFolders ? 'Same folder only' : 'Show all folders'}
              </button>
            </p>
          {/if}
          <div class="space-y-2">
            {#each candidates as candidate (candidate.id)}
              {@const isSelected = selectedCandidateIds.has(candidate.id)}
              {@const candidateActivity = candidate.activities?.[0]}
              <label
                class="flex cursor-pointer items-center gap-3 rounded border border-border bg-card p-3 hover:bg-card-hover {isSelected
                  ? 'border-accent bg-accent/10'
                  : ''}"
              >
                <input
                  type="checkbox"
                  class="h-4 w-4 rounded border-border text-accent focus:ring-2 focus:ring-accent"
                  checked={isSelected}
                  onchange={() => onToggleCandidate(candidate.id)}
                />
                <span
                  class="material-icons shrink-0 inline-flex items-center justify-center text-text-secondary"
                  style="font-size: 2.5rem; width: 2.5rem; height: 2.5rem; line-height: 1;"
                  aria-hidden="true">{getActivityIcon(candidateActivity?.type)}</span
                >
                <div class="min-w-0 flex-1">
                  <div class="font-medium text-text-primary">{candidateActivity?.type || '—'}</div>
                  <div class="text-sm text-text-secondary">
                    {getActivityDeviceName(candidateActivity ?? {})}
                  </div>
                  <div
                    class="truncate text-sm text-text-secondary"
                    title={candidate.name || undefined}
                  >
                    {candidate.name || '—'}
                  </div>
                  <div class="text-sm text-text-secondary">
                    {formatDateWithTime(candidateActivity?.startDate ?? candidate.startDate)}
                  </div>
                </div>
              </label>
            {/each}
          </div>
        {/if}
      </div>

      <div class="flex items-center justify-end gap-3 border-t border-border p-6">
        <button
          type="button"
          class="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-text-primary shadow-sm hover:bg-card-hover"
          onclick={onCancel}
        >
          Cancel
        </button>
        <button
          type="button"
          class="rounded-md border-0 bg-accent px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-accent-hover disabled:opacity-50"
          onclick={onCompare}
          disabled={selectedCandidateIds.size === 0}
        >
          Compare ({selectedCandidateIds.size + 1} event{selectedCandidateIds.size + 1 !== 1
            ? 's'
            : ''})
        </button>
      </div>
    </div>
  </div>
{/if}
