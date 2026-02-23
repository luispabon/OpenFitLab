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
  }
  let {
    events,
    selectedActivities,
    allStatTypes,
    eventColors,
    getActivityDeviceName,
    calculateDelta,
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
          <tr>
            <td class="whitespace-nowrap px-6 py-4 font-medium text-text-primary">{statType}</td>
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
