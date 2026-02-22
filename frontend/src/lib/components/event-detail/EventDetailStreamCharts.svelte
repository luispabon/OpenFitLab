<script lang="ts">
  import type { Activity, StreamData } from '../../types'
  import { getStreamConfig } from '../../utils/stream-config'
  import TimeSeriesChart from '../TimeSeriesChart.svelte'
  import OverlayChart from '../OverlayChart.svelte'

  interface Props {
    streamsLoading: boolean
    streamsError: string | null
    chartableStreams: StreamData[]
    chartableStreamsOrdered: StreamData[]
    selectedStreamTypes: Set<string>
    viewMode: 'stacked' | 'overlay'
    visibleStreams: StreamData[]
    activityStartDate: number
    activities: Activity[]
    selectedActivityId: string | null
    hasSelectedActivity: boolean
    onToggleStream: (type: string) => void
    onViewModeStacked: () => void
    onViewModeOverlay: () => void
    onSelectActivity: (activityId: string) => void
  }
  let {
    streamsLoading,
    streamsError,
    chartableStreams,
    chartableStreamsOrdered,
    selectedStreamTypes,
    viewMode,
    visibleStreams,
    activityStartDate,
    activities,
    selectedActivityId,
    hasSelectedActivity,
    onToggleStream,
    onViewModeStacked,
    onViewModeOverlay,
    onSelectActivity,
  }: Props = $props()
</script>

{#if streamsLoading}
  <div class="mt-6 space-y-6">
    <div class="flex flex-col gap-4">
      <h2 class="text-xl font-semibold text-text-primary">Activity Metrics</h2>
      <div class="space-y-6">
        {#each [1, 2, 3] as _}
          <div
            class="animate-pulse overflow-hidden rounded-xl border border-border bg-card p-6 shadow-sm backdrop-blur"
          >
            <div class="h-64 w-full rounded bg-surface"></div>
          </div>
        {/each}
      </div>
    </div>
  </div>
{:else if streamsError}
  <div class="mt-6 rounded-md border border-border bg-card p-4 backdrop-blur">
    <p class="text-sm font-medium text-text-primary">
      {streamsError}
    </p>
    <p class="mt-1 text-xs text-text-secondary">
      Charts will not be available for this activity.
    </p>
  </div>
{:else if chartableStreams.length > 0}
  <div class="mt-6 space-y-6">
    <div class="flex flex-col gap-4">
      <div class="flex items-center justify-between">
        <div class="flex flex-col gap-2">
          <h2 class="text-xl font-semibold text-text-primary">Activity Metrics</h2>

          {#if activities.length > 1}
            <div class="flex gap-1 border-b border-border">
              {#each activities as activity (activity.id)}
                {@const isSelected = selectedActivityId === activity.id}
                <button
                  type="button"
                  class="px-3 py-2 text-sm font-medium transition-colors {isSelected
                    ? 'border-b-2 border-accent text-accent'
                    : 'text-text-secondary hover:text-text-primary'}"
                  onclick={() => onSelectActivity(activity.id)}
                >
                  {activity.name || activity.type || `Activity ${activities.indexOf(activity) + 1}`}
                </button>
              {/each}
            </div>
          {/if}
        </div>

        <div class="flex items-center gap-2">
          <span class="text-sm text-text-secondary">View:</span>
          <button
            type="button"
            class="rounded border px-3 py-1 text-sm transition-colors {viewMode === 'stacked'
              ? 'border-border bg-card text-text-primary'
              : 'border-border bg-transparent text-text-secondary hover:bg-card-hover'}"
            onclick={onViewModeStacked}
          >
            Stacked
          </button>
          <button
            type="button"
            class="rounded border px-3 py-1 text-sm transition-colors {viewMode === 'overlay'
              ? 'border-border bg-card text-text-primary'
              : 'border-border bg-transparent text-text-secondary hover:bg-card-hover'}"
            onclick={onViewModeOverlay}
          >
            Overlay
          </button>
        </div>
      </div>

      <div class="flex flex-wrap gap-2">
        {#each chartableStreamsOrdered as stream (stream.type)}
          {@const config = getStreamConfig(stream.type)}
          {@const isSelected = selectedStreamTypes.has(stream.type)}
          <button
            type="button"
            class="flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors {isSelected
              ? 'text-text-primary'
              : 'border-border bg-transparent text-text-muted hover:bg-card-hover'}"
            style={isSelected ? `background-color: ${config.color}26; border-color: ${config.color}66` : ''}
            onclick={() => onToggleStream(stream.type)}
          >
            <span
              class="h-2 w-2 rounded-full {isSelected ? '' : 'opacity-40'}"
              style="background-color: {config.color};"
            ></span>
            <span>{config.label}</span>
          </button>
        {/each}
      </div>
    </div>

    {#if visibleStreams.length > 0}
      {#if viewMode === 'overlay'}
        <div
          class="overflow-hidden rounded-xl border border-border bg-card p-6 shadow-sm backdrop-blur-lg"
        >
          <OverlayChart streams={visibleStreams} {activityStartDate} />
        </div>
      {:else}
        <div class="space-y-6">
          {#each visibleStreams as stream (stream.type)}
            <div
              class="overflow-hidden rounded-xl border border-border bg-card p-6 shadow-sm backdrop-blur-lg"
            >
              <TimeSeriesChart streamData={stream} {activityStartDate} />
            </div>
          {/each}
        </div>
      {/if}
    {:else}
      <div class="flex h-32 items-center justify-center rounded-lg border border-border bg-card">
        <p class="text-sm text-text-secondary">
          Select metrics above to view charts
        </p>
      </div>
    {/if}
  </div>
{:else if hasSelectedActivity}
  <div class="mt-6 rounded-md border border-border bg-card p-4 backdrop-blur">
    <p class="text-sm font-medium text-text-primary">
      No stream data available
    </p>
    <p class="mt-1 text-xs text-text-secondary">
      This activity does not contain time-series data (heart rate, speed, etc.).
    </p>
  </div>
{/if}
