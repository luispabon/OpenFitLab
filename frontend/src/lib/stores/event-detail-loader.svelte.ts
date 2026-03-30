import { getEvent, getStreams, updateActivity } from '../api';
import { getComparisonsByEventIds } from '../api/comparisons';
import { isAbortError } from '../api/client';
import type { Activity, EventDetail, EventSummary, StreamData } from '../types';
import type { ComparisonSummary } from '../api/comparisons';
import type { StatEntry, StatsByCategory } from '../utils/stat-categories';
import {
  getActivityIcon,
  hasLocationStreams,
  isChartableStream,
  isSmoothVariantToHide,
} from '../utils';
import { selectKeyMetrics, getGroupedDeduplicatedStats } from '../utils/stat-categories';
import { getStatUnit } from '../utils/stat-icons';
import { formatStatValue } from '../utils/stat-formatting';

const EMPTY_ACTIVITIES: Activity[] = [];
const EMPTY_STREAMS: StreamData[] = [];
const EMPTY_COMPARISONS: ComparisonSummary[] = [];

let currentEventId: string | null = null;
let loadGeneration = 0;
let abortController: AbortController | null = null;

function safeSet<T>(next: T): T {
  return next;
}

function deriveMainActivityType(
  event: EventSummary | null,
  selectedActivity: Activity | null
): string {
  if (!event) return '';
  const fromSelected = selectedActivity?.type;
  if (fromSelected) return fromSelected;

  const activityTypes = event.stats?.['Activity Types'];
  if (Array.isArray(activityTypes) && activityTypes.length > 0) return String(activityTypes[0]);
  if (typeof activityTypes === 'string') return activityTypes;
  return '';
}

function deriveStatEntries(event: EventSummary | null): StatEntry[] {
  if (!event?.stats) return [];
  return Object.entries(event.stats).map(([statType, raw]) => ({
    statType,
    value: formatStatValue(raw, statType),
    unit: getStatUnit(statType),
  }));
}

export interface PowerCurveSeriesRow {
  activityId: string;
  activityName: string;
  data: Array<{ duration: number; power: number }>;
}

function derivePowerCurveSeries(
  event: EventSummary | null,
  selectedActivity: Activity | null
): PowerCurveSeriesRow[] {
  const pc = selectedActivity?.stats?.['PowerCurve'] ?? event?.stats?.['PowerCurve'];
  if (!Array.isArray(pc) || pc.length === 0) return [];
  const curve = pc as unknown as Array<{ duration: number; power: number }>;
  return [
    {
      activityId: selectedActivity?.id ?? event?.id ?? '',
      activityName: 'Power',
      data: curve,
    },
  ];
}

function derivePowerCurveMaxDuration(selectedActivity: Activity | null) {
  if (!selectedActivity?.startDate || !selectedActivity?.endDate) return undefined;
  return Math.round((selectedActivity.endDate - selectedActivity.startDate) / 1000);
}

function deriveChartableStreams(streams: StreamData[]): StreamData[] {
  const allStreamTypes = streams.map((s) => s.type);
  return streams.filter(
    (s) =>
      isChartableStream(s.type) &&
      s.data &&
      s.data.length > 0 &&
      !isSmoothVariantToHide(s.type, allStreamTypes)
  );
}

function orderStreamsHeartRateFirst(streams: StreamData[]): StreamData[] {
  const list = [...streams];
  const hr = list.find((s) => s.type === 'Heart Rate');
  if (!hr) return list;
  return [hr, ...list.filter((s) => s.type !== 'Heart Rate')];
}

export const state = $state({
  status: 'idle' as 'idle' | 'loading' | 'loaded' | 'error',
  eventDetail: null as EventDetail | null,
  event: null as EventSummary | null,
  activities: EMPTY_ACTIVITIES as Activity[],

  loading: true,
  /** True while PATCH activity (inline edit); does not gate stream charts like `loading`. */
  saving: false,
  error: null as string | null,

  selectedActivityId: null as string | null,
  selectedActivity: null as Activity | null,

  streams: EMPTY_STREAMS as StreamData[],
  streamsLoading: false,
  streamsError: null as string | null,

  relatedComparisons: EMPTY_COMPARISONS as ComparisonSummary[],
  relatedComparisonsLoading: false,
  relatedComparisonsError: null as string | null,

  // Stream toggles
  selectedStreamTypes: new Set<string>() as Set<string>,
  hasInitializedSelection: false,
  chartableStreams: EMPTY_STREAMS as StreamData[],
  chartableStreamsOrdered: EMPTY_STREAMS as StreamData[],
  visibleStreams: EMPTY_STREAMS as StreamData[],
  locationAvailable: false,

  // Derived charts
  activityStartDate: Date.now(),
  powerCurveSeries: [] as PowerCurveSeriesRow[],
  powerCurveMaxDuration: undefined as number | undefined,

  // Derived stats
  mainActivityType: '' as string,
  activityTypeIcon: '' as string,
  keyMetrics: [] as StatEntry[],
  statEntries: [] as StatEntry[],
  groupedStatsSections: [] as StatsByCategory[],
  keyMetricTypes: new Set<string>() as Set<string>,
  hasMoreStats: false,
});

function recomputeStatsAndSelection(): void {
  const event = state.event;
  const selectedActivity = state.selectedActivity;

  state.mainActivityType = deriveMainActivityType(event, selectedActivity);
  state.activityTypeIcon = getActivityIcon(state.mainActivityType);

  state.keyMetrics = event ? safeSet(selectKeyMetrics(event.stats, state.mainActivityType)) : [];
  state.statEntries = deriveStatEntries(event);
  state.groupedStatsSections = safeSet(getGroupedDeduplicatedStats(state.statEntries));
  state.keyMetricTypes = new Set(state.keyMetrics.map((e) => e.statType));
  state.hasMoreStats = state.groupedStatsSections.some((section) =>
    section.entries.some((entry) => !state.keyMetricTypes.has(entry.statType))
  );

  state.activityStartDate = selectedActivity?.startDate ?? event?.startDate ?? Date.now();

  state.powerCurveSeries = derivePowerCurveSeries(event, selectedActivity);
  state.powerCurveMaxDuration = derivePowerCurveMaxDuration(selectedActivity);
}

function recomputeStreamsDerived(): void {
  const chartableStreams = deriveChartableStreams(state.streams);
  state.chartableStreams = chartableStreams;
  state.chartableStreamsOrdered = orderStreamsHeartRateFirst(chartableStreams);
  state.locationAvailable = hasLocationStreams(state.streams);

  if (!state.hasInitializedSelection && state.chartableStreamsOrdered.length > 0) {
    const hasHeartRate = state.chartableStreamsOrdered.some((s) => s.type === 'Heart Rate');
    state.selectedStreamTypes = hasHeartRate
      ? new Set(['Heart Rate'])
      : new Set([state.chartableStreamsOrdered[0].type]);
    state.hasInitializedSelection = true;
  }

  state.visibleStreams = state.chartableStreamsOrdered.filter((s) =>
    state.selectedStreamTypes.has(s.type)
  );
}

export function setSelectedActivityId(activityId: string | null): void {
  state.selectedActivityId = activityId;
  state.selectedActivity = state.activities.find((a) => a.id === activityId) ?? null;
  state.hasInitializedSelection = false;
  state.selectedStreamTypes = new Set<string>();

  // Re-load streams for the new selection; eventId is set by load().
  if (!currentEventId || !activityId) {
    state.streams = [];
    state.streamsLoading = false;
    state.streamsError = null;
    recomputeStatsAndSelection();
    return;
  }

  void loadStreams(currentEventId, activityId);
  recomputeStatsAndSelection();
}

export function toggleStream(type: string): void {
  const next = new Set(state.selectedStreamTypes);
  if (next.has(type)) next.delete(type);
  else next.add(type);
  state.selectedStreamTypes = next;
  state.visibleStreams = state.chartableStreamsOrdered.filter((s) => next.has(s.type));
}

export async function loadEventDetail(eventId: string): Promise<void> {
  const normalized = eventId || '';
  // Avoid re-running the empty-id branch when the route $effect fires again after state updates
  // (otherwise effect_update_depth_exceeded).
  if (!normalized && state.status === 'error' && state.error === 'Event not found.') {
    return;
  }

  currentEventId = eventId || null;
  loadGeneration++;
  const myGen = loadGeneration;

  if (!eventId) {
    state.status = 'error';
    state.loading = false;
    state.error = 'Event not found.';
    state.eventDetail = null;
    state.event = null;
    state.activities = EMPTY_ACTIVITIES;
    state.selectedActivityId = null;
    state.selectedActivity = null;
    state.streams = EMPTY_STREAMS;
    state.streamsLoading = false;
    state.streamsError = null;
    state.relatedComparisons = EMPTY_COMPARISONS;
    state.relatedComparisonsLoading = false;
    state.relatedComparisonsError = null;
    state.selectedStreamTypes = new Set();
    state.hasInitializedSelection = false;
    state.chartableStreams = EMPTY_STREAMS;
    state.chartableStreamsOrdered = EMPTY_STREAMS;
    state.visibleStreams = EMPTY_STREAMS;
    state.locationAvailable = false;
    state.mainActivityType = '';
    state.keyMetrics = [];
    state.statEntries = [];
    state.groupedStatsSections = [];
    state.keyMetricTypes = new Set();
    state.hasMoreStats = false;
    recomputeStatsAndSelection();
    return;
  }

  if (abortController) abortController.abort();
  abortController = new AbortController();

  state.status = 'loading';
  state.loading = true;
  state.error = null;
  state.eventDetail = null;
  state.event = null;
  state.activities = EMPTY_ACTIVITIES;
  state.selectedActivityId = null;
  state.selectedActivity = null;

  state.streams = EMPTY_STREAMS;
  state.streamsLoading = true;
  state.streamsError = null;
  state.relatedComparisonsLoading = true;
  state.relatedComparisonsError = null;
  state.relatedComparisons = EMPTY_COMPARISONS;

  state.selectedStreamTypes = new Set<string>();
  state.hasInitializedSelection = false;
  state.chartableStreams = EMPTY_STREAMS;
  state.chartableStreamsOrdered = EMPTY_STREAMS;
  state.visibleStreams = EMPTY_STREAMS;
  state.locationAvailable = false;

  try {
    const data = await getEvent(eventId, { signal: abortController.signal });
    if (myGen !== loadGeneration) return;

    state.eventDetail = data;
    state.event = data.event;
    state.activities = data.activities;

    // Preserve selected activity if possible; else pick first.
    const current = state.selectedActivityId;
    const selected =
      (current && data.activities.some((a) => a.id === current) ? current : null) ??
      data.activities[0]?.id ??
      null;

    state.selectedActivityId = selected;
    state.selectedActivity = data.activities.find((a) => a.id === selected) ?? null;

    recomputeStatsAndSelection();

    state.status = 'loaded';
    state.loading = false;

    // Related comparisons load in the background so the page is not blocked on this request.
    void (async () => {
      try {
        const comparisons = await getComparisonsByEventIds([eventId]);
        if (myGen !== loadGeneration) return;
        state.relatedComparisons = comparisons;
      } catch (e) {
        if (myGen !== loadGeneration) return;
        state.relatedComparisonsError =
          e instanceof Error ? e.message : 'Failed to load related comparisons';
        state.relatedComparisons = [];
      } finally {
        if (myGen === loadGeneration) {
          state.relatedComparisonsLoading = false;
        }
      }
    })();

    await loadStreams(eventId, selected, myGen);
  } catch (e) {
    if (myGen !== loadGeneration) return;
    if (isAbortError(e)) return;
    state.status = 'error';
    state.loading = false;
    state.error = e instanceof Error ? e.message : 'Event not found';
    state.eventDetail = null;
    state.event = null;
    state.activities = EMPTY_ACTIVITIES;
    state.selectedActivityId = null;
    state.selectedActivity = null;
    state.streams = EMPTY_STREAMS;
    state.streamsLoading = false;
    state.streamsError = null;
    state.relatedComparisons = EMPTY_COMPARISONS;
    state.relatedComparisonsLoading = false;
    state.relatedComparisonsError = null;
  }
}

async function loadStreams(
  eventId: string,
  activityId: string | null,
  myGenOverride?: number
): Promise<void> {
  if (!activityId) {
    state.streams = [];
    state.streamsLoading = false;
    state.streamsError = null;
    state.hasInitializedSelection = false;
    state.selectedStreamTypes = new Set();
    state.chartableStreams = EMPTY_STREAMS;
    state.chartableStreamsOrdered = EMPTY_STREAMS;
    state.visibleStreams = EMPTY_STREAMS;
    return;
  }

  const myGen = myGenOverride ?? loadGeneration;

  state.streamsLoading = true;
  state.streamsError = null;

  try {
    const loaded = await getStreams(eventId, activityId, undefined, {
      signal: abortController?.signal,
    });
    if (myGen !== loadGeneration) return;
    state.streams = loaded;
    state.hasInitializedSelection = false;
    state.selectedStreamTypes = new Set();
    recomputeStreamsDerived();
  } catch (e) {
    if (myGen !== loadGeneration) return;
    if (isAbortError(e)) return;
    state.streamsError = e instanceof Error ? e.message : 'Failed to load streams';
    state.streams = [];
  } finally {
    if (myGen === loadGeneration) {
      state.streamsLoading = false;
    }
  }
}

export async function commitActivityType(newType: string): Promise<void> {
  const event = state.event;
  const firstActivity = state.activities[0];
  if (!currentEventId || !event || !firstActivity) return;

  state.saving = true;
  state.error = null;

  try {
    const updated = await updateActivity(currentEventId, firstActivity.id, { type: newType });
    // Mirror the route's eventDetail mutation logic so UI stays consistent.
    if (state.eventDetail) {
      const nextActivities = state.eventDetail.activities.map((a) =>
        a.id === updated.id ? updated : a
      );
      const types = [
        ...new Set(nextActivities.map((a) => a.type).filter((t): t is string => Boolean(t))),
      ].sort();
      state.eventDetail = {
        ...state.eventDetail,
        activities: nextActivities,
        event: {
          ...state.eventDetail.event,
          stats: {
            ...state.eventDetail.event.stats,
            'Activity Types': types as unknown as
              | string
              | number
              | number[]
              | Record<string, unknown>,
          },
        },
      };
      state.event = state.eventDetail.event;
      state.activities = state.eventDetail.activities;
      state.selectedActivity =
        state.activities.find((a) => a.id === state.selectedActivityId) ?? null;
      recomputeStatsAndSelection();
    }
  } catch (e) {
    state.error = e instanceof Error ? e.message : 'Failed to update activity type';
    throw e;
  } finally {
    state.saving = false;
  }
}

export async function commitDevice(newDevice: string): Promise<void> {
  const act = state.selectedActivity;
  if (!currentEventId || !act) return;

  state.saving = true;
  state.error = null;

  try {
    const updated = await updateActivity(currentEventId, act.id, { deviceName: newDevice });
    if (state.eventDetail) {
      state.eventDetail = {
        ...state.eventDetail,
        activities: state.eventDetail.activities.map((a) => (a.id === updated.id ? updated : a)),
      };
      state.activities = state.eventDetail.activities;
      state.selectedActivity =
        state.activities.find((a) => a.id === state.selectedActivityId) ?? null;
      recomputeStatsAndSelection();
    }
  } catch (e) {
    state.error = e instanceof Error ? e.message : 'Failed to update device';
    throw e;
  } finally {
    state.saving = false;
  }
}
