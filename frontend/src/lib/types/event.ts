export interface EventSummary {
  id: string;
  name: string;
  startDate: number;
  endDate?: number;
  description?: string;
  isMerge?: boolean;
  stats: Record<string, number | string | number[] | Record<string, unknown>>;
  activities?: Activity[];
  srcFileType?: string;
}

export interface EventDetail {
  event: EventSummary;
  activities: Activity[];
}

export interface Activity {
  id: string;
  eventID: string;
  eventStartDate?: number;
  name?: string;
  startDate?: number;
  endDate?: number;
  type?: string;
  stats: Record<string, number | string | number[] | Record<string, unknown>>;
  deviceName?: string;
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

export interface UploadResponse {
  id: string;
  event: EventSummary;
  activities: Activity[];
}

export interface ComparisonSettings {
  selectedStreams?: string[];
  xAxisMode?: 'elapsed' | 'wall-clock';
  selectedActivities?: Record<string, string>; // eventId -> activityId
}

export interface Comparison {
  id: string;
  name: string;
  eventIds: string[];
  settings?: ComparisonSettings;
  createdAt?: number;
}
