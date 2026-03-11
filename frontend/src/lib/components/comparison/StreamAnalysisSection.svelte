<script lang="ts">
  import type { EventDetail, StreamData } from '../../types';
  import {
    isChartableStream,
    isSmoothVariantToHide,
    getStreamConfig,
    getActivityDeviceName,
  } from '../../utils';
  import {
    alignStreams,
    buildDeltaSeries,
    computeStreamAnalysisStats,
    computeLinearRegression,
  } from '../../utils/stream-analysis';
  import StreamAnalysisCard from './StreamAnalysisCard.svelte';

  interface Props {
    events: EventDetail[];
    streamsByEventId: Record<string, StreamData[]>;
    selectedActivities: Record<string, string>;
    referenceActivityId: string | null;
    eventColors: string[];
  }

  let { events, streamsByEventId, selectedActivities, referenceActivityId, eventColors }: Props =
    $props();

  let selectedStreamType = $state<string | null>(null);

  // Derive referenceEventId from referenceActivityId
  const referenceEventId = $derived.by(() => {
    if (!referenceActivityId) {
      return events.length > 0 ? events[0].event.id : null;
    }
    for (const [eventId, actId] of Object.entries(selectedActivities)) {
      if (actId === referenceActivityId) return eventId;
    }
    return events.length > 0 ? events[0].event.id : null;
  });

  // Reference event detail
  const referenceEventDetail = $derived(
    events.find((e) => e.event.id === referenceEventId) ?? null
  );

  // Secondary event details (all except reference)
  const secondaryEvents = $derived(events.filter((e) => e.event.id !== referenceEventId));

  // Available stream types: intersection across all events, chartable, not smooth variant hidden
  const availableStreamTypes = $derived.by(() => {
    if (events.length < 2) return [];

    const typeSets: Set<string>[] = [];
    for (const eventDetail of events) {
      const eventId = eventDetail.event.id;
      const streams = streamsByEventId[eventId] ?? [];
      const allTypesForEvent = streams.map((s) => s.type);
      const types = new Set<string>();
      for (const stream of streams) {
        if (
          isChartableStream(stream.type) &&
          !isSmoothVariantToHide(stream.type, allTypesForEvent) &&
          stream.data &&
          stream.data.length > 0
        ) {
          types.add(stream.type);
        }
      }
      typeSets.push(types);
    }

    if (typeSets.length === 0) return [];

    let result = new Set(typeSets[0]);
    for (let i = 1; i < typeSets.length; i++) {
      result = new Set([...result].filter((t) => typeSets[i].has(t)));
    }

    return Array.from(result).sort();
  });

  // Auto-select first stream type when available types change
  $effect(() => {
    if (availableStreamTypes.length > 0) {
      if (!selectedStreamType || !availableStreamTypes.includes(selectedStreamType)) {
        selectedStreamType = availableStreamTypes.includes('Heart Rate')
          ? 'Heart Rate'
          : availableStreamTypes[0];
      }
    } else {
      selectedStreamType = null;
    }
  });

  // Get stream data for an event and stream type
  function getStream(eventId: string, streamType: string): StreamData | null {
    return streamsByEventId[eventId]?.find((s) => s.type === streamType) ?? null;
  }

  // Get activity start date for an event
  function getActivityStart(eventDetail: EventDetail): number {
    const activityId = selectedActivities[eventDetail.event.id];
    const activity = eventDetail.activities.find((a) => a.id === activityId);
    return activity?.startDate ?? eventDetail.event.startDate ?? 0;
  }

  function getDeviceName(eventDetail: EventDetail): string {
    const activityId = selectedActivities[eventDetail.event.id];
    const activity = eventDetail.activities.find((a) => a.id === activityId);
    return activity ? getActivityDeviceName(activity) : eventDetail.event.name || 'Unknown';
  }

  function getEventColor(eventDetail: EventDetail): string {
    const idx = events.findIndex((e) => e.event.id === eventDetail.event.id);
    return eventColors[idx % eventColors.length];
  }
</script>

<div class="mb-6">
  <h2 class="mb-4 text-xl font-semibold text-text-primary">Stream Analysis</h2>

  {#if availableStreamTypes.length === 0}
    <div class="flex items-center justify-center rounded-lg border border-border bg-card p-8">
      <p class="text-sm text-text-secondary">No common streams available for analysis</p>
    </div>
  {:else}
    <!-- Stream type selector -->
    <div class="mb-4 flex flex-wrap gap-2">
      {#each availableStreamTypes as streamType (streamType)}
        {@const config = getStreamConfig(streamType)}
        {@const isSelected = selectedStreamType === streamType}
        <button
          type="button"
          class="flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors {isSelected
            ? 'text-text-primary'
            : 'border-border bg-transparent text-text-muted hover:bg-card-hover'}"
          style={isSelected
            ? `background-color: ${config.color}26; border-color: ${config.color}66`
            : ''}
          onclick={() => (selectedStreamType = streamType)}
        >
          <span
            class="h-2 w-2 rounded-full {isSelected ? '' : 'opacity-40'}"
            style="background-color: {config.color};"
          ></span>
          <span>{config.label}</span>
        </button>
      {/each}
    </div>

    {#if selectedStreamType && referenceEventDetail}
      {@const refStream = getStream(referenceEventDetail.event.id, selectedStreamType)}
      {@const refStart = getActivityStart(referenceEventDetail)}
      {@const refDeviceName = getDeviceName(referenceEventDetail)}
      {@const streamConfig = getStreamConfig(selectedStreamType)}

      <div class="space-y-6">
        {#each secondaryEvents as secEvent (secEvent.event.id)}
          {@const secStream = getStream(secEvent.event.id, selectedStreamType)}
          {@const secStart = getActivityStart(secEvent)}
          {@const secDeviceName = getDeviceName(secEvent)}
          {@const secColor = getEventColor(secEvent)}

          {#if refStream && secStream}
            {@const pairs = alignStreams(
              refStream.data as Array<{ time: number; value: number }>,
              secStream.data as Array<{ time: number; value: number }>,
              refStart,
              secStart
            )}
            {@const deltaData = buildDeltaSeries(
              refStream.data as Array<{ time: number; value: number }>,
              secStream.data as Array<{ time: number; value: number }>,
              refStart,
              secStart
            )}
            {@const stats = computeStreamAnalysisStats(pairs)}
            {@const regression = computeLinearRegression(pairs)}

            <StreamAnalysisCard
              {refDeviceName}
              {secDeviceName}
              {streamConfig}
              {secColor}
              {pairs}
              {regression}
              {stats}
              {deltaData}
            />
          {/if}
        {/each}
      </div>
    {/if}
  {/if}
</div>
