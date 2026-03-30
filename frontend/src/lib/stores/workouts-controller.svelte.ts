import { untrack } from 'svelte';
import { getActivityRows } from '../api';
import type { ActivityRow } from '../types';

const EMPTY_ROWS: ActivityRow[] = [];

export const state = $state({
  activityRowsFromApi: EMPTY_ROWS as ActivityRow[],
  totalRows: 0,
  isLoading: false,
  loadGeneration: 0,

  search: '',
  selectedActivityTypes: [] as string[],
  selectedDevices: [] as string[],
  dateStartStr: '',
  dateEndStr: '',
  page: 1,
  pageSize: 20,
});

/**
 * Load activity rows for the workouts list. Pass current folder selection from the route
 * (`all` | `unfiled` | folder id).
 */
export async function loadActivityRows(activeFolderId: string): Promise<void> {
  const myGen = untrack(() => {
    state.loadGeneration += 1;
    return state.loadGeneration;
  });
  state.isLoading = true;
  try {
    const offset = (state.page - 1) * state.pageSize;
    const startDate = state.dateStartStr
      ? new Date(state.dateStartStr + 'T00:00:00').getTime()
      : undefined;
    const endDate = state.dateEndStr
      ? new Date(state.dateEndStr + 'T23:59:59.999').getTime()
      : undefined;
    const params: Parameters<typeof getActivityRows>[0] = {
      limit: state.pageSize,
      offset,
      startDate,
      endDate,
      activityTypes: state.selectedActivityTypes.length ? state.selectedActivityTypes : undefined,
      devices: state.selectedDevices.length ? state.selectedDevices : undefined,
      search: state.search.trim() || undefined,
      folderId: activeFolderId === 'all' ? undefined : activeFolderId,
    };
    const result = await getActivityRows(params);
    if (myGen !== state.loadGeneration) return;
    state.activityRowsFromApi = result.rows;
    state.totalRows = result.total;
  } catch (err) {
    if (myGen !== state.loadGeneration) return;
    console.error('Failed to load activity rows:', err);
    throw err;
  } finally {
    if (myGen === state.loadGeneration) state.isLoading = false;
  }
}

export function setSearch(value: string): void {
  state.search = value;
  state.page = 1;
}

export function toggleActivityType(type: string): void {
  const next = state.selectedActivityTypes.includes(type)
    ? state.selectedActivityTypes.filter((t) => t !== type)
    : [...state.selectedActivityTypes, type];
  state.selectedActivityTypes = next;
  state.page = 1;
}

export function toggleDevice(device: string): void {
  const next = state.selectedDevices.includes(device)
    ? state.selectedDevices.filter((d) => d !== device)
    : [...state.selectedDevices, device];
  state.selectedDevices = next;
  state.page = 1;
}

export function setDateStart(value: string): void {
  state.dateStartStr = value;
  state.page = 1;
}

export function setDateEnd(value: string): void {
  state.dateEndStr = value;
  state.page = 1;
}

export function setPage(n: number): void {
  state.page = n;
}

export function setPageSize(n: number): void {
  state.pageSize = n;
}

/** For tests / hard reset */
export function resetWorkoutsController(): void {
  state.activityRowsFromApi = EMPTY_ROWS;
  state.totalRows = 0;
  state.isLoading = false;
  state.loadGeneration = 0;
  state.search = '';
  state.selectedActivityTypes = [];
  state.selectedDevices = [];
  state.dateStartStr = '';
  state.dateEndStr = '';
  state.page = 1;
  state.pageSize = 20;
}
