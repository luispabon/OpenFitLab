<script lang="ts">
  import type { EventDetail } from '../../types';
  import { getStatUnit } from '../../utils/stat-icons';
  import { formatStatValue } from '../../utils/stat-formatting';
  import { exportAsPng } from '../../utils/export-image';
  import ExportButton from '../ExportButton.svelte';

  interface Props {
    events: EventDetail[];
    selectedActivities: Record<string, string>;
    allStatTypes: string[];
    eventColors: string[];
    getActivityDeviceName: (activity: { deviceName?: string }) => string;
    calculateDelta: (
      refValue: unknown,
      secValue: unknown
    ) => { absolute: number; percent: number } | null;
    onHideStat?: (statType: string) => void;
    referenceEventId?: string;
  }
  let {
    events,
    selectedActivities,
    allStatTypes,
    eventColors,
    getActivityDeviceName,
    calculateDelta,
    onHideStat,
    referenceEventId,
  }: Props = $props();

  // Index of the reference event in the events array
  const refIndex = $derived(
    referenceEventId != null ? events.findIndex((e) => e.event.id === referenceEventId) : -1
  );

  // Whether delta columns should be shown
  const showDeltas = $derived(refIndex >= 0);

  // Ordered events: ref first, then others in original order
  const orderedEvents = $derived.by(() => {
    if (refIndex < 0) return events;
    return [events[refIndex], ...events.filter((_, i) => i !== refIndex)];
  });

  // Get color by original index in events (stable across reorders)
  function getEventColor(eventDetail: EventDetail): string {
    const idx = events.findIndex((e) => e.event.id === eventDetail.event.id);
    return eventColors[idx % eventColors.length];
  }

  let tableEl = $state<HTMLElement | null>(null);
</script>

<div
  bind:this={tableEl}
  class="mb-6 overflow-hidden rounded-lg border border-border bg-card shadow backdrop-blur-lg"
>
  <div class="flex items-center justify-between border-b border-border px-6 py-3">
    <span class="text-sm font-medium uppercase tracking-wider text-text-secondary">Stats</span>
    {#if tableEl}
      <ExportButton
        onExport={() => exportAsPng(tableEl!, 'comparison-stats')}
        title="Export stats as PNG"
      />
    {/if}
  </div>
  <div class="overflow-x-auto">
    <table class="min-w-full divide-y divide-border">
      <thead class="bg-surface">
        <tr>
          <th
            scope="col"
            class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary"
          >
            Stat
          </th>
          {#each orderedEvents as eventDetail (eventDetail.event.id)}
            {@const eventId = eventDetail.event.id}
            {@const activityId = selectedActivities[eventId]}
            {@const activity = eventDetail.activities.find((a) => a.id === activityId)}
            {@const isRef = showDeltas && eventDetail.event.id === referenceEventId}
            {@const color = isRef ? '#ef4444' : getEventColor(eventDetail)}
            {@const originalIndex = events.findIndex((e) => e.event.id === eventId)}
            <th
              scope="col"
              class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary"
              style="border-left: 2px solid {color};"
            >
              {activity
                ? getActivityDeviceName(activity)
                : eventDetail.event.name || `Event ${originalIndex + 1}`}
              {#if isRef}
                <span
                  class="ml-1 rounded px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                  style="background-color: #ef444426; color: #ef4444;">Ref</span
                >
              {/if}
            </th>
            {#if showDeltas && !isRef}
              <th
                scope="col"
                class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary"
              >
                Δ
              </th>
            {/if}
          {/each}
        </tr>
      </thead>
      <tbody class="divide-y divide-border bg-transparent">
        {#each allStatTypes as statType (statType)}
          {@const refValue = (() => {
            const refEventDetail = events.find((e) => e.event.id === referenceEventId);
            if (!refEventDetail) return undefined;
            const activityId = selectedActivities[refEventDetail.event.id];
            const activity = refEventDetail.activities.find((a) => a.id === activityId);
            return activity?.stats?.[statType];
          })()}
          <tr class="group">
            <td class="whitespace-nowrap px-6 py-4 font-medium text-text-primary">
              {statType}
              {#if onHideStat}
                <button
                  type="button"
                  class="ml-2 opacity-0 group-hover:opacity-100 transition-opacity text-text-secondary hover:text-text-primary"
                  onclick={() => onHideStat(statType)}
                  title="Hide this row"
                  aria-label="Hide {statType} row"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="inline h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <path
                      d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"
                    />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                </button>
              {/if}
            </td>
            {#each orderedEvents as eventDetail (eventDetail.event.id)}
              {@const eventId = eventDetail.event.id}
              {@const activityId = selectedActivities[eventId]}
              {@const activity = eventDetail.activities.find((a) => a.id === activityId)}
              {@const value = activity?.stats?.[statType]}
              {@const formatted = value != null ? formatStatValue(value, statType) : '---'}
              {@const unit = getStatUnit(statType)}
              {@const displayValue = unit ? `${formatted} ${unit}` : formatted}
              {@const isRef = showDeltas && eventDetail.event.id === referenceEventId}
              <td class="whitespace-nowrap px-6 py-4 text-text-secondary">{displayValue}</td>
              {#if showDeltas && !isRef}
                {@const delta = calculateDelta(refValue, value)}
                <td class="whitespace-nowrap px-4 py-4 text-text-secondary">
                  {#if delta}
                    <span class={delta.absolute >= 0 ? 'text-green-500' : 'text-red-500'}>
                      {delta.absolute >= 0 ? '+' : ''}{formatStatValue(delta.absolute, statType)}
                      {delta.percent !== 0
                        ? ` (${delta.percent >= 0 ? '+' : ''}${delta.percent.toFixed(1)}%)`
                        : ''}
                    </span>
                  {:else}
                    —
                  {/if}
                </td>
              {/if}
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>
