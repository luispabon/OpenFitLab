import type {
  EventSummary,
  EventDetail,
  StreamData,
  UploadResponse,
  Activity,
  ActivityRow,
} from '../types/event';

const API_BASE = '/api';
import { apiFetch } from './client';

export interface GetEventsParams {
  startDate?: number;
  endDate?: number;
  limit?: number;
}

export async function getEvents(params?: GetEventsParams): Promise<EventSummary[]> {
  const searchParams = new URLSearchParams();
  if (params?.startDate != null) {
    searchParams.set('startDate', String(params.startDate));
  }
  if (params?.endDate != null) {
    searchParams.set('endDate', String(params.endDate));
  }
  searchParams.set('limit', String(params?.limit ?? 50));

  const url = `${API_BASE}/events?${searchParams.toString()}`;
  const response = await apiFetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch events: ${response.statusText}`);
  }

  return response.json();
}

export interface GetActivityRowsParams {
  limit?: number;
  offset?: number;
  startDate?: number;
  endDate?: number;
  activityTypes?: string[];
  devices?: string[];
  search?: string;
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

  const url = `${API_BASE}/events/activity-rows?${searchParams.toString()}`;
  const response = await apiFetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch activity rows: ${response.statusText}`);
  }

  return response.json();
}

export async function getEvent(id: string): Promise<EventDetail> {
  const response = await apiFetch(`${API_BASE}/events/${id}`);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Event not found');
    }
    throw new Error(`Failed to fetch event: ${response.statusText}`);
  }

  return response.json();
}

export async function getActivityTypes(): Promise<string[]> {
  const response = await apiFetch(`${API_BASE}/activity-types`);
  if (!response.ok) {
    throw new Error(`Failed to fetch activity types: ${response.statusText}`);
  }
  return response.json();
}

export async function getDevices(): Promise<string[]> {
  const response = await apiFetch(`${API_BASE}/devices`);
  if (!response.ok) {
    throw new Error(`Failed to fetch devices: ${response.statusText}`);
  }
  return response.json();
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
  return response.json();
}

export async function getStreams(
  eventId: string,
  activityId: string,
  types?: string[]
): Promise<StreamData[]> {
  const searchParams = new URLSearchParams();
  if (types && types.length > 0) {
    types.forEach((type) => searchParams.append('types', type));
  }

  const url = `${API_BASE}/events/${eventId}/activities/${activityId}/streams${
    searchParams.toString() ? `?${searchParams.toString()}` : ''
  }`;
  const response = await apiFetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch streams: ${response.statusText}`);
  }

  return response.json();
}

export async function uploadFile(
  file: File,
  onProgress?: (progress: number) => void
): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('files', file);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    // Set up progress tracking
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && onProgress) {
        const progress = (event.loaded / event.total) * 100;
        onProgress(progress);
      }
    });

    // Handle completion
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          // Ensure progress is set to 100% on success
          if (onProgress) {
            onProgress(100);
          }
          resolve(response);
        } catch (_error) {
          reject(new Error('Failed to parse response'));
        }
      } else {
        try {
          const error = JSON.parse(xhr.responseText);
          reject(new Error(error.error || `Failed to upload file: ${xhr.statusText}`));
        } catch {
          reject(new Error(`Failed to upload file: ${xhr.statusText}`));
        }
      }
    });

    // Handle errors
    xhr.addEventListener('error', () => {
      reject(new Error('Network error during upload'));
    });

    xhr.addEventListener('abort', () => {
      reject(new Error('Upload aborted'));
    });

    // Start the request
    xhr.open('POST', `${API_BASE}/events`);
    xhr.withCredentials = true;
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
