import type { EventSummary, Comparison, ComparisonSettings } from '../types/event';

const API_BASE = '/api';
import { apiFetch } from './client';

function assertComparison(data: unknown): asserts data is Comparison {
  const d = data as Record<string, unknown> | undefined;
  if (!d || typeof d.id !== 'string') {
    throw new Error('Invalid comparison response: missing id');
  }
  if (typeof d.name !== 'string') {
    throw new Error('Invalid comparison response: missing name');
  }
  if (!Array.isArray(d.eventIds)) {
    throw new Error('Invalid comparison response: missing eventIds array');
  }
  if (!Array.isArray(d.activityIds)) {
    throw new Error('Invalid comparison response: missing activityIds array');
  }
}

export async function getComparisonCandidates(eventId: string): Promise<EventSummary[]> {
  const response = await apiFetch(`${API_BASE}/events/${eventId}/candidates`);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Event not found');
    }
    throw new Error(`Failed to fetch comparison candidates: ${response.statusText}`);
  }

  return response.json();
}

export async function getComparisons(): Promise<Comparison[]> {
  const response = await apiFetch(`${API_BASE}/comparisons`);

  if (!response.ok) {
    throw new Error(`Failed to fetch comparisons: ${response.statusText}`);
  }

  return response.json();
}

export interface GetComparisonOptions {
  signal?: AbortSignal;
}

export async function getComparison(
  id: string,
  options?: GetComparisonOptions
): Promise<Comparison> {
  const response = await apiFetch(`${API_BASE}/comparisons/${id}`, { signal: options?.signal });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Comparison not found');
    }
    throw new Error(`Failed to fetch comparison: ${response.statusText}`);
  }

  const data = await response.json();
  assertComparison(data);
  return data;
}

export interface ComparisonSummary {
  id: string;
  name: string;
  createdAt?: number;
}

export async function getComparisonsByEventIds(eventIds: string[]): Promise<ComparisonSummary[]> {
  const response = await apiFetch(`${API_BASE}/comparisons/by-events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ eventIds }),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch comparisons: ${response.statusText}`);
  }

  return response.json();
}

export async function createComparison(
  name: string,
  activityIds: string[],
  settings?: ComparisonSettings
): Promise<Comparison> {
  const response = await apiFetch(`${API_BASE}/comparisons`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name, activityIds, settings }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `Failed to create comparison: ${response.statusText}`);
  }

  const data = await response.json();
  assertComparison(data);
  return data;
}

export async function deleteComparison(id: string): Promise<boolean> {
  const response = await apiFetch(`${API_BASE}/comparisons/${id}`, {
    method: 'DELETE',
  });

  if (response.status === 404) {
    return false;
  }

  if (!response.ok) {
    throw new Error(`Failed to delete comparison: ${response.statusText}`);
  }

  return true;
}
