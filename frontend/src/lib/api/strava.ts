import { apiFetch } from './client';

export interface StravaStatusResponse {
  configured: boolean;
  connected?: boolean;
  expiresAt?: number | null;
}

export interface StravaActivityListItem {
  id: string;
  name: string;
  startDate: number;
  type: string | null;
  sportType: string | null;
  distance: number | null;
  movingTime: number | null;
  alreadyImported: boolean;
  eventId: string | null;
}

export interface StravaImportResultItem {
  externalId: string;
  success: boolean;
  eventId?: string;
  error?: string;
}

async function readError(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: string };
    return typeof j.error === 'string' ? j.error : res.statusText;
  } catch {
    return res.statusText;
  }
}

export async function fetchStravaStatus(): Promise<StravaStatusResponse> {
  const res = await apiFetch('/api/integrations/strava/status');
  if (!res.ok) {
    throw new Error(await readError(res));
  }
  return res.json() as Promise<StravaStatusResponse>;
}

export async function fetchStravaActivities(params: {
  page?: number;
  perPage?: number;
}): Promise<{ activities: StravaActivityListItem[] }> {
  const sp = new URLSearchParams();
  if (params.page != null) sp.set('page', String(params.page));
  if (params.perPage != null) sp.set('perPage', String(params.perPage));
  const q = sp.toString();
  const res = await apiFetch(`/api/integrations/strava/activities${q ? `?${q}` : ''}`);
  if (!res.ok) {
    throw new Error(await readError(res));
  }
  return res.json() as Promise<{ activities: StravaActivityListItem[] }>;
}

export async function importStravaActivities(
  externalIds: string[],
  folderId: string | null
): Promise<{ results: StravaImportResultItem[] }> {
  const body: { externalIds: string[]; folderId?: string } = { externalIds };
  if (folderId) body.folderId = folderId;
  const res = await apiFetch('/api/integrations/strava/import', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': crypto.randomUUID(),
    },
    body: JSON.stringify(body),
  });
  if (res.status === 409) {
    throw new Error(await readError(res));
  }
  if (!res.ok) {
    throw new Error(await readError(res));
  }
  return res.json() as Promise<{ results: StravaImportResultItem[] }>;
}
