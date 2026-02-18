import type { EventSummary, EventDetail, StreamData, UploadResponse } from '../types/event'

const API_BASE = '/api'

export interface GetEventsParams {
  startDate?: number
  endDate?: number
  limit?: number
}

export async function getEvents(params?: GetEventsParams): Promise<EventSummary[]> {
  const searchParams = new URLSearchParams()
  if (params?.startDate != null) {
    searchParams.set('startDate', String(params.startDate))
  }
  if (params?.endDate != null) {
    searchParams.set('endDate', String(params.endDate))
  }
  searchParams.set('limit', String(params?.limit ?? 50))

  const url = `${API_BASE}/events?${searchParams.toString()}`
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Failed to fetch events: ${response.statusText}`)
  }

  return response.json()
}

export async function getEvent(id: string): Promise<EventDetail> {
  const response = await fetch(`${API_BASE}/events/${id}`)

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Event not found')
    }
    throw new Error(`Failed to fetch event: ${response.statusText}`)
  }

  return response.json()
}

export async function getStreams(
  eventId: string,
  activityId: string,
  types?: string[]
): Promise<StreamData[]> {
  const searchParams = new URLSearchParams()
  if (types && types.length > 0) {
    types.forEach((type) => searchParams.append('types', type))
  }

  const url = `${API_BASE}/events/${eventId}/activities/${activityId}/streams${
    searchParams.toString() ? `?${searchParams.toString()}` : ''
  }`
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Failed to fetch streams: ${response.statusText}`)
  }

  return response.json()
}

export async function uploadFile(file: File): Promise<UploadResponse> {
  const formData = new FormData()
  formData.append('files', file)

  const response = await fetch(`${API_BASE}/events`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }))
    throw new Error(error.error || `Failed to upload file: ${response.statusText}`)
  }

  return response.json()
}

export async function deleteEvent(id: string): Promise<boolean> {
  const response = await fetch(`${API_BASE}/events/${id}`, {
    method: 'DELETE',
  })

  if (response.status === 404) {
    return false
  }

  if (!response.ok) {
    throw new Error(`Failed to delete event: ${response.statusText}`)
  }

  return true
}
