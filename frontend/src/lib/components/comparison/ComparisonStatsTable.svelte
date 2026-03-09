<script lang="ts">
  import type { EventDetail } from '../../types';
  import { getStatUnit } from '../../utils/stat-icons';
  import { formatStatValue } from '../../utils/stat-formatting';

  interface Props {
    events: EventDetail[];
    selectedActivities: Record<string, string>;
    allStatTypes: string[];
    eventColors: string[];
    getActivityDeviceName: (activity: { deviceName?: string }) => string;
    calculateDelta: (
      value1: unknown,
      value2: unknown
    ) => { absolute: number; percent: number } | null;
    onHideStat?: (statType: string) => void;
  }
  let {
    events,
    selectedActivities,
    allStatTypes,
    eventColors,
    getActivityDeviceName,
    calculateDelta,
    onHideStat,
  }: Props = $props();
</script>

<div class="mb-6 overflow-hidden rounded-lg border border-border bg-card shadow backdrop-blur-lg">
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
          {#each events as eventDetail, i (eventDetail.event.id)}
            {@const eventId = eventDetail.event.id}
            {@const activityId = selectedActivities[eventId]}
            {@const activity = eventDetail.activities.find((a) => a.id === activityId)}
            {@const color = eventColors[i % eventColors.length]}
            <th
              scope="col"
              class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary"
              style="border-left: 2px solid {color};"
            >
              {activity
                ? getActivityDeviceName(activity)
                : eventDetail.event.name || `Event ${i + 1}`}
            </th>
          {/each}
          {#if events.length === 2}
            <th
              scope="col"
              class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary"
            >
              Delta
            </th>
          {/if}
        </tr>
      </thead>
      <tbody class="divide-y divide-border bg-transparent">
        {#each allStatTypes as statType (statType)}
          {@const values = events.map((eventDetail) => {
            const eventId = eventDetail.event.id;
            const activityId = selectedActivities[eventId];
            const activity = eventDetail.activities.find((a) => a.id === activityId);
            return activity?.stats?.[statType];
          })}
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
            {#each events as eventDetail (eventDetail.event.id)}
              {@const eventId = eventDetail.event.id}
              {@const activityId = selectedActivities[eventId]}
              {@const activity = eventDetail.activities.find((a) => a.id === activityId)}
              {@const value = activity?.stats?.[statType]}
              {@const formatted = value != null ? formatStatValue(value, statType) : '---'}
              {@const unit = getStatUnit(statType)}
              {@const displayValue = unit ? `${formatted} ${unit}` : formatted}
              <td class="whitespace-nowrap px-6 py-4 text-text-secondary">{displayValue}</td>
            {/each}
            {#if events.length === 2}
              {@const delta = calculateDelta(values[0], values[1])}
              <td class="whitespace-nowrap px-6 py-4 text-text-secondary">
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
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>
