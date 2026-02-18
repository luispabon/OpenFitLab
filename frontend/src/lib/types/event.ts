export interface EventSummary {
  id: string
  name: string
  startDate: number
  endDate?: number
  privacy: string
  description?: string
  isMerge?: boolean
  stats: Record<string, number | string | number[] | Record<string, unknown>>
  [key: string]: unknown // For payload_rest fields
}

export interface EventDetail {
  event: EventSummary
  activities: Activity[]
}

export interface Activity {
  id: string
  eventID: string
  eventStartDate?: number
  name?: string
  startDate?: number
  endDate?: number
  type?: string
  stats: Record<string, number | string | number[] | Record<string, unknown>>
  [key: string]: unknown // For payload_rest fields
}

export interface StreamData {
  type: string
  data: Array<{
    time: number
    value: number | Record<string, unknown>
  }>
}

export interface UploadResponse {
  id: string
  event: EventSummary
  activities: Activity[]
}
