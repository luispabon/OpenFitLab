/**
 * Reactive loader for comparison view: loads saved comparison or events from query,
 * then events and streams. Replaces manual cache invalidation (loadedComparisonId,
 * loadedEventIds, loadedStreamsSignature, lastLoadAttempt) with a single load key.
 */
import { getEvent, getStreams, getComparison } from '../api';
import { isAbortError } from '../api/client';
import type { EventDetail, StreamData, Comparison } from '../types';
import { isChartableStream, isSmoothVariantToHide } from './stream-config';

const EMPTY_EVENTS: EventDetail[] = [];
const EMPTY_STREAMS: Record<string, StreamData[]> = {};

let lastLoadedKey = '';
let loadGeneration = 0;
let loadedStreamsSignature = '';
let abortController: AbortController | null = null;

/** Single reactive state object (mutate properties, do not reassign) so it can be exported. */
export const state = $state({
  status: 'idle' as 'idle' | 'loading' | 'loaded' | 'error',
  comparison: null as Comparison | null,
  events: EMPTY_EVENTS as EventDetail[],
  streamsByEventId: EMPTY_STREAMS as Record<string, StreamData[]>,
  error: null as string | null,
  selectedActivities: {} as Record<string, string>,
  selectedStreamTypes: new Set<string>() as Set<string>,
  xAxisMode: 'elapsed' as 'elapsed' | 'wall-clock',
});

export function setSelectedActivities(
  updater: (prev: Record<string, string>) => Record<string, string>
) {
  state.selectedActivities = updater(state.selectedActivities);
}

export function setSelectedStreamTypes(updater: (prev: Set<string>) => Set<string>) {
  state.selectedStreamTypes = updater(state.selectedStreamTypes);
}

export function setXAxisMode(value: 'elapsed' | 'wall-clock') {
  state.xAxisMode = value;
}

export function setComparison(value: Comparison | null) {
  state.comparison = value;
}

/** Reset module-level state (for tests). */
export function reset(): void {
  if (abortController) abortController.abort();
  abortController = null;
  lastLoadedKey = '';
  loadGeneration = 0;
  loadedStreamsSignature = '';
  state.status = 'idle';
  state.comparison = null;
  state.events = EMPTY_EVENTS;
  state.streamsByEventId = EMPTY_STREAMS;
  state.error = null;
  state.selectedActivities = {};
  state.selectedStreamTypes = new Set();
  state.xAxisMode = 'elapsed';
}

function deriveKey(comparisonId: string, eventIdsFromQuery: string[]): string {
  if (comparisonId === 'new') {
    const ids = eventIdsFromQuery.filter((id) => id.trim().length > 0).sort();
    return ids.length >= 2 ? `new:${ids.join(',')}` : '';
  }
  return comparisonId;
}

async function loadEventsAndStreams(
  eventIds: string[],
  signal: AbortSignal,
  myGen: number
): Promise<void> {
  const loadedEvents = await Promise.all(eventIds.map((id) => getEvent(id, { signal })));
  if (myGen !== loadGeneration) return;
  state.events = loadedEvents;

  let activitiesChanged = false;
  const nextActivities = { ...state.selectedActivities };
  for (const eventDetail of loadedEvents) {
    const eventId = eventDetail.event.id;
    if (!nextActivities[eventId] && eventDetail.activities.length > 0) {
      nextActivities[eventId] = eventDetail.activities[0].id;
      activitiesChanged = true;
    }
  }
  if (activitiesChanged && myGen === loadGeneration) {
    state.selectedActivities = nextActivities;
  }

  const currentActivityIds = loadedEvents
    .map(
      (e) =>
        `${e.event.id}:${(activitiesChanged ? nextActivities : state.selectedActivities)[e.event.id] || ''}`
    )
    .sort()
    .join('|');

  const streamsToLoad: Record<string, StreamData[]> = {};
  await Promise.all(
    loadedEvents.map(async (eventDetail) => {
      const eventId = eventDetail.event.id;
      const activityId = (activitiesChanged ? nextActivities : state.selectedActivities)[eventId];
      if (!activityId) return;
      try {
        const loaded = await getStreams(eventId, activityId, undefined, { signal });
        if (myGen === loadGeneration) streamsToLoad[eventId] = loaded;
      } catch (e) {
        if (!isAbortError(e) && myGen === loadGeneration) {
          console.error(`Failed to load streams for event ${eventId}:`, e);
          streamsToLoad[eventId] = [];
        }
      }
    })
  );
  if (myGen !== loadGeneration) return;
  state.streamsByEventId = streamsToLoad;
  loadedStreamsSignature = currentActivityIds;

  if (state.selectedStreamTypes.size === 0) {
    const allStreamTypes = new Set<string>();
    for (const streamList of Object.values(streamsToLoad)) {
      for (const stream of streamList) {
        if (
          isChartableStream(stream.type) &&
          !isSmoothVariantToHide(
            stream.type,
            streamList.map((s) => s.type)
          )
        ) {
          allStreamTypes.add(stream.type);
        }
      }
      if (allStreamTypes.has('Heart Rate')) {
        state.selectedStreamTypes = new Set(['Heart Rate']);
      } else if (allStreamTypes.size > 0) {
        state.selectedStreamTypes = new Set([Array.from(allStreamTypes)[0]]);
      }
    }
  }
}

/**
 * Called by the route when comparisonId or eventIdsFromQuery change.
 * Uses a single "loaded key" to avoid duplicate or infinite loads.
 */
export function load(comparisonId: string, eventIdsFromQuery: string[]): void {
  const requestedKey = deriveKey(comparisonId, eventIdsFromQuery);
  if (requestedKey === '' && comparisonId === 'new') {
    state.error = 'At least 2 events are required for comparison';
    state.status = 'error';
    return;
  }
  if (requestedKey === lastLoadedKey && state.status === 'loading') return;
  if (requestedKey === lastLoadedKey && state.status === 'loaded') return;

  loadGeneration++;
  const myGen = loadGeneration;
  lastLoadedKey = requestedKey;
  state.status = 'loading';
  state.error = null;
  if (comparisonId === 'new') {
    state.comparison = null;
  }

  if (abortController) abortController.abort();
  abortController = new AbortController();
  const signal = abortController.signal;

  if (comparisonId === 'new') {
    const ids = eventIdsFromQuery.filter((id) => id.trim().length > 0).sort();
    if (ids.length < 2) {
      state.error = 'At least 2 events are required for comparison';
      state.status = 'error';
      return;
    }
    loadEventsAndStreams(ids, signal, myGen)
      .then(() => {
        if (myGen === loadGeneration) state.status = 'loaded';
      })
      .catch((e) => {
        if (isAbortError(e)) return;
        if (myGen === loadGeneration) {
          state.error = e instanceof Error ? e.message : 'Failed to load events';
          state.events = EMPTY_EVENTS;
          state.streamsByEventId = EMPTY_STREAMS;
          state.status = 'error';
        }
      })
      .finally(() => {
        if (myGen === loadGeneration)
          state.status = state.status === 'loading' ? 'loaded' : state.status;
      });
    return;
  }

  getComparison(comparisonId, { signal })
    .then((comp) => {
      if (myGen !== loadGeneration) return;
      state.comparison = comp;
      if (comp.settings) {
        state.xAxisMode = comp.settings.xAxisMode ?? 'elapsed';
        state.selectedStreamTypes = new Set(comp.settings.selectedStreams ?? []);
        state.selectedActivities = comp.settings.selectedActivities ?? {};
      }
      const ids = comp.eventIds;
      if (ids.length < 2) {
        state.error = 'At least 2 events are required for comparison';
        state.status = 'error';
        return;
      }
      return loadEventsAndStreams(ids, signal, myGen);
    })
    .then(() => {
      if (myGen === loadGeneration) state.status = 'loaded';
    })
    .catch((e) => {
      if (isAbortError(e)) return;
      if (myGen === loadGeneration) {
        state.error = e instanceof Error ? e.message : 'Failed to load comparison';
        state.comparison = null;
        state.status = 'error';
      }
    })
    .finally(() => {
      if (myGen === loadGeneration)
        state.status = state.status === 'loading' ? 'loaded' : state.status;
    });
}

/**
 * Reload streams for current events and selectedActivities (e.g. after user changes activity).
 */
export async function loadStreams(): Promise<void> {
  const evs = state.events;
  const currentActivityIds = evs
    .map((e) => `${e.event.id}:${state.selectedActivities[e.event.id] || ''}`)
    .sort()
    .join('|');
  if (
    loadedStreamsSignature === currentActivityIds &&
    Object.keys(state.streamsByEventId).length > 0
  ) {
    return;
  }

  const streamsToLoad: Record<string, StreamData[]> = {};
  await Promise.all(
    evs.map(async (eventDetail) => {
      const eventId = eventDetail.event.id;
      const activityId = state.selectedActivities[eventId];
      if (!activityId) return;
      try {
        const loaded = await getStreams(eventId, activityId);
        streamsToLoad[eventId] = loaded;
      } catch (e) {
        console.error(`Failed to load streams for event ${eventId}:`, e);
        streamsToLoad[eventId] = [];
      }
    })
  );
  state.streamsByEventId = streamsToLoad;
  loadedStreamsSignature = currentActivityIds;
}
