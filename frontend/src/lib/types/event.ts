/** Sentinel values for folder selection (UI-only; not persisted as folder rows). */
export const FOLDER_SELECTION_ALL = 'all' as const;
export const FOLDER_SELECTION_UNFILED = 'unfiled' as const;
export type FolderSelectionValue =
  | typeof FOLDER_SELECTION_ALL
  | typeof FOLDER_SELECTION_UNFILED
  | string;

export interface Folder {
  id: string;
  name: string;
  color: string;
  pinned: boolean;
  eventCount?: number;
  comparisonCount?: number;
  createdAt?: number;
}

/** Preset hex colors for folder color picker (12 colors). */
export const FOLDER_PRESET_COLORS = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#06b6d4',
  '#3b82f6',
  '#8b5cf6',
  '#a855f7',
  '#d946ef',
  '#ec4899',
  '#6b7280',
] as const;

export interface EventSummary {
  id: string;
  name: string;
  startDate: number;
  endDate?: number;
  description?: string;
  isMerge?: boolean;
  stats: Record<string, number | string | number[] | string[] | Record<string, unknown>>;
  activities?: Activity[];
  srcFileType?: string;
  startTimezone?: string;
  endTimezone?: string;
  /** Folder this event belongs to; null/undefined = Unfiled. */
  folderId?: string | null;
}

export interface EventDetail {
  event: EventSummary;
  activities: Activity[];
}

export interface Activity {
  id: string;
  eventID: string;
  name?: string;
  startDate?: number;
  endDate?: number;
  type?: string;
  stats: Record<string, number | string | number[] | string[] | Record<string, unknown>>;
  deviceName?: string;
  startTimezone?: string;
  endTimezone?: string;
}

export interface ActivityRow {
  event: EventSummary;
  activity: Activity;
}

export interface StreamData {
  type: string;
  data: Array<{
    time: number;
    value: number | Record<string, unknown>;
  }>;
}

export interface BatchUploadResultSuccess {
  success: true;
  filename: string;
  id: string;
  event: EventSummary;
  activities: Activity[];
}

export interface BatchUploadResultFailure {
  success: false;
  filename: string;
  error: string;
}

export type BatchUploadResult = BatchUploadResultSuccess | BatchUploadResultFailure;

export interface BatchUploadResponse {
  results: BatchUploadResult[];
}

export interface ComparisonSettings {
  selectedStreams?: string[];
  xAxisMode?: 'elapsed' | 'wall-clock';
  hiddenStats?: string[];
}

export interface Comparison {
  id: string;
  name: string;
  eventIds: string[];
  /** Activity IDs for the comparison, parallel to eventIds (same order). */
  activityIds?: string[];
  settings?: ComparisonSettings;
  createdAt?: number;
  /** Home folder for this comparison; null/undefined = Unfiled. */
  folderId?: string | null;
  /** True when comparison references events from more than one folder. */
  mixed?: boolean;
  /** True when comparison is shown in a folder view because it references an event in that folder (home folder may differ). */
  surfaced?: boolean;
}
