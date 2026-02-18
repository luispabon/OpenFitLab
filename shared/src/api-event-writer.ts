import type { AppEventInterface } from './app-event.interface';
import type { ActivityInterface } from '@sports-alliance/sports-lib';

export interface OriginalFileInput {
  data: ArrayBuffer | Blob | Uint8Array;
  extension: string;
  startDate: Date;
  originalFilename?: string;
}

export interface WriteEventToApiResult {
  id: string;
  event: Record<string, unknown>;
  activities: unknown[];
}

export interface UploadFileToApiResult {
  id: string;
  event: Record<string, unknown>;
  activities: unknown[];
}

/**
 * Ensures the event and its activities have IDs, then POSTs event + activities + files to the API.
 * Returns the API response (includes originalFile/originalFiles from server).
 * @deprecated Use uploadFileToApi instead - this function is kept for backward compatibility
 */
export async function writeEventToApi(
  apiBaseUrl: string,
  userID: string,
  event: AppEventInterface,
  originalFiles?: OriginalFileInput[] | OriginalFileInput
): Promise<WriteEventToApiResult> {
  const base = apiBaseUrl.replace(/\/$/, '');
  const url = `${base}/api/events`;

  // Don't set IDs here - backend will generate UUIDs for each upload
  // Remove any existing IDs to ensure backend generates new ones
  const eventJson = event.toJSON() as unknown as Record<string, unknown>;
  delete eventJson['id'];
  delete eventJson['activities'];
  const activities = event.getActivities();
  const startDateMs = event.startDate instanceof Date ? event.startDate.getTime() : (event.startDate ? new Date(event.startDate as number).getTime() : Date.now());

  const activitiesJson = activities.map((a: ActivityInterface) => {
    const j = a.toJSON() as unknown as Record<string, unknown>;
    delete j['id']; // Backend will generate UUID
    // Extract streams before deleting - they'll be stored separately
    const streams = j['streams'];
    delete j['streams'];
    // Backend will set eventID and eventStartDate when it generates the UUIDs
    // We just set eventStartDate here for reference
    j['eventStartDate'] = startDateMs;
    // Store streams in a temporary property to send to API
    if (streams) {
      (j as any)._streams = streams;
    }
    return j;
  });

  const files = originalFiles ? (Array.isArray(originalFiles) ? originalFiles : [originalFiles]) : [];

  if (files.length === 0) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: eventJson, activities: activitiesJson }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API error ${res.status}: ${text}`);
    }
    return (await res.json()) as WriteEventToApiResult;
  }

  const form = new FormData();
  form.append('event', JSON.stringify(eventJson));
  form.append('activities', JSON.stringify(activitiesJson));
  for (const f of files) {
    const blob = f.data instanceof Blob ? f.data : f.data instanceof ArrayBuffer ? new Blob([f.data]) : new Blob([f.data]);
    const name = f.originalFilename || `file.${f.extension}`;
    form.append('files', blob, name);
  }

  const res = await fetch(url, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return (await res.json()) as WriteEventToApiResult;
}

/**
 * Uploads a raw file to the API. The backend will parse the file and store the processed data.
 * @param apiBaseUrl - Base URL of the API
 * @param userID - User ID (currently not used but kept for future authentication)
 * @param file - File to upload
 * @returns API response with generated event and activity IDs
 */
export async function uploadFileToApi(
  apiBaseUrl: string,
  userID: string,
  file: File
): Promise<UploadFileToApiResult> {
  const base = apiBaseUrl.replace(/\/$/, '');
  const url = `${base}/api/events`;

  const form = new FormData();
  form.append('files', file);

  const res = await fetch(url, {
    method: 'POST',
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }

  return (await res.json()) as UploadFileToApiResult;
}
