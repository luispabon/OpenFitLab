import type { EventSummary, Comparison, ComparisonSettings } from '../types/event';

const API_BASE = '/api';

export async function getComparisonCandidates(eventId: string): Promise<EventSummary[]> {
  const response = await fetch(`${API_BASE}/events/${eventId}/candidates`);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Event not found');
    }
    throw new Error(`Failed to fetch comparison candidates: ${response.statusText}`);
  }

  return response.json();
}

export async function getComparisons(): Promise<Comparison[]> {
  const response = await fetch(`${API_BASE}/comparisons`);

  if (!response.ok) {
    throw new Error(`Failed to fetch comparisons: ${response.statusText}`);
  }

  return response.json();
}

export async function getComparison(id: string): Promise<Comparison> {
  const response = await fetch(`${API_BASE}/comparisons/${id}`);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Comparison not found');
    }
    throw new Error(`Failed to fetch comparison: ${response.statusText}`);
  }

  return response.json();
}

export async function createComparison(
  name: string,
  eventIds: string[],
  settings?: ComparisonSettings
): Promise<Comparison> {
  const response = await fetch(`${API_BASE}/comparisons`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name, eventIds, settings }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `Failed to create comparison: ${response.statusText}`);
  }

  return response.json();
}

export async function deleteComparison(id: string): Promise<boolean> {
  const response = await fetch(`${API_BASE}/comparisons/${id}`, {
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
