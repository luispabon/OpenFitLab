import type {
  EventDetail,
  StreamData,
  BatchUploadResponse,
  Activity,
  ActivityRow,
} from '../types/event';

const API_BASE = '/api';
import { apiFetch } from './client';
import { setCurrentUser, state as authState } from '../stores/auth.svelte';

function assertEventDetail(data: unknown): asserts data is EventDetail {
  const d = data as Record<string, unknown>;
  const event = d?.event as Record<string, unknown> | undefined;
  if (!event || typeof event.id !== 'string') {
    throw new Error('Invalid event response: missing event.id');
  }
  if (!Array.isArray(d?.activities)) {
    throw new Error('Invalid event response: missing activities array');
  }
}

function assertActivityRowsResponse(
  data: unknown
): asserts data is { rows: ActivityRow[]; total: number } {
  const d = data as Record<string, unknown> | undefined;
  if (!Array.isArray(d?.rows)) {
    throw new Error('Invalid activity rows response: missing rows array');
  }
  if (typeof d?.total !== 'number') {
    throw new Error('Invalid activity rows response: missing total');
  }
}

function assertActivity(data: unknown): asserts data is Activity {
  const d = data as Record<string, unknown> | undefined;
  if (!d || typeof d.id !== 'string') {
    throw new Error('Invalid activity response: missing id');
  }
}

function assertStreamDataArray(data: unknown): asserts data is StreamData[] {
  if (!Array.isArray(data)) {
    throw new Error('Invalid streams response: expected array');
  }
  for (let i = 0; i < data.length; i++) {
    const item = data[i] as Record<string, unknown> | undefined;
    if (!item || typeof item.type !== 'string') {
      throw new Error(`Invalid streams response: item ${i} missing type`);
    }
    if (!Array.isArray(item.data)) {
      throw new Error(`Invalid streams response: item ${i} missing data array`);
    }
  }
}

export interface GetActivityRowsParams {
  limit?: number;
  offset?: number;
  startDate?: number;
  endDate?: number;
  activityTypes?: string[];
  devices?: string[];
  search?: string;
  /** 'all' | 'unfiled' | folder UUID */
  folderId?: string | null;
}

export async function getActivityRows(
  params: GetActivityRowsParams = {}
): Promise<{ rows: ActivityRow[]; total: number }> {
  const searchParams = new URLSearchParams();
  if (params.limit != null) searchParams.set('limit', String(params.limit));
  if (params.offset != null) searchParams.set('offset', String(params.offset));
  if (params.startDate != null) searchParams.set('startDate', String(params.startDate));
  if (params.endDate != null) searchParams.set('endDate', String(params.endDate));
  if (params.search != null && params.search.trim() !== '') {
    searchParams.set('search', params.search.trim());
  }
  if (params.activityTypes?.length) {
    params.activityTypes.forEach((t) => searchParams.append('activityTypes', t));
  }
  if (params.devices?.length) {
    params.devices.forEach((d) => searchParams.append('devices', d));
  }
  if (params.folderId != null && params.folderId !== '' && params.folderId !== 'all') {
    searchParams.set('folderId', params.folderId);
  }

  const url = `${API_BASE}/events/activity-rows?${searchParams.toString()}`;
  const response = await apiFetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch activity rows: ${response.statusText}`);
  }

  const data = await response.json();
  assertActivityRowsResponse(data);
  return data;
}

export interface GetEventOptions {
  signal?: AbortSignal;
}

export async function getEvent(id: string, options?: GetEventOptions): Promise<EventDetail> {
  const response = await apiFetch(`${API_BASE}/events/${id}`, { signal: options?.signal });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Event not found');
    }
    throw new Error(`Failed to fetch event: ${response.statusText}`);
  }

  const data = await response.json();
  assertEventDetail(data);
  return data;
}

export async function getActivityTypes(): Promise<string[]> {
  const response = await apiFetch(`${API_BASE}/activity-types`);
  if (!response.ok) {
    throw new Error(`Failed to fetch activity types: ${response.statusText}`);
  }
  const data = await response.json();
  if (!Array.isArray(data)) throw new Error('Invalid activity types response: expected array');
  return data;
}

export async function getDevices(): Promise<string[]> {
  const response = await apiFetch(`${API_BASE}/devices`);
  if (!response.ok) {
    throw new Error(`Failed to fetch devices: ${response.statusText}`);
  }
  const data = await response.json();
  if (!Array.isArray(data)) throw new Error('Invalid devices response: expected array');
  return data;
}

export async function updateActivity(
  eventId: string,
  activityId: string,
  updates: { type?: string; deviceName?: string }
): Promise<Activity> {
  const response = await apiFetch(`${API_BASE}/events/${eventId}/activities/${activityId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Activity not found');
    }
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Failed to update activity: ${response.statusText}`);
  }
  const data = await response.json();
  assertActivity(data);
  return data;
}

export interface GetStreamsOptions {
  signal?: AbortSignal;
}

export async function getStreams(
  eventId: string,
  activityId: string,
  types?: string[],
  options?: GetStreamsOptions
): Promise<StreamData[]> {
  const searchParams = new URLSearchParams();
  if (types && types.length > 0) {
    types.forEach((type) => searchParams.append('types', type));
  }

  const url = `${API_BASE}/events/${eventId}/activities/${activityId}/streams${
    searchParams.toString() ? `?${searchParams.toString()}` : ''
  }`;
  const response = await apiFetch(url, { signal: options?.signal });

  if (!response.ok) {
    throw new Error(`Failed to fetch streams: ${response.statusText}`);
  }

  const data = await response.json();
  assertStreamDataArray(data);
  return data;
}

export interface UploadFilesOptions {
  folderId?: string | null;
}

export async function uploadFiles(
  files: File[],
  onProgress?: (progress: number) => void,
  options?: UploadFilesOptions
): Promise<BatchUploadResponse> {
  const formData = new FormData();
  for (const file of files) {
    formData.append('files', file);
  }
  if (options?.folderId != null && options.folderId !== '' && options.folderId !== 'all') {
    formData.append('folderId', options.folderId);
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && onProgress) {
        const progress = (event.loaded / event.total) * 100;
        onProgress(progress);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status === 401) {
        setCurrentUser(null);
      }
      if (xhr.status === 403) {
        authState.csrfToken = null;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText) as BatchUploadResponse;
          if (onProgress) {
            onProgress(100);
          }
          resolve(response);
        } catch (_error) {
          reject(new Error('Failed to parse response'));
        }
      } else {
        let message: string;
        try {
          const body = JSON.parse(xhr.responseText) as { error?: string };
          if (typeof body?.error === 'string') {
            message = body.error;
          } else {
            message =
              xhr.status === 403
                ? 'Invalid or missing CSRF token'
                : `Failed to upload: ${xhr.statusText}`;
          }
        } catch {
          message =
            xhr.status === 403
              ? 'Invalid or missing CSRF token'
              : `Failed to upload: ${xhr.statusText}`;
        }
        reject(new Error(message));
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Network error during upload'));
    });

    xhr.addEventListener('abort', () => {
      reject(new Error('Upload aborted'));
    });

    xhr.open('POST', `${API_BASE}/events`);
    xhr.withCredentials = true;
    if (authState.csrfToken) {
      xhr.setRequestHeader('CSRF-Token', authState.csrfToken);
    }
    xhr.send(formData);
  });
}

export async function deleteEvent(id: string): Promise<boolean> {
  const response = await apiFetch(`${API_BASE}/events/${id}`, {
    method: 'DELETE',
  });

  if (response.status === 404) {
    return false;
  }

  if (!response.ok) {
    throw new Error(`Failed to delete event: ${response.statusText}`);
  }

  return true;
}

export async function updateEventFolder(eventId: string, folderId: string | null): Promise<void> {
  const response = await apiFetch(`${API_BASE}/events/${eventId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folderId }),
  });

  if (response.status === 404) {
    throw new Error('Event not found');
  }
  if (!response.ok) {
    throw new Error(`Failed to update event folder: ${response.statusText}`);
  }
}
