export interface FormattedDate {
  date: string
  time: string
}

export function formatDate(d: Date | number | undefined | null): FormattedDate {
  if (d == null) return { date: '', time: '' }
  const date = d instanceof Date ? d : new Date(d)
  const dateStr = date.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  const timeStr = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
  return { date: dateStr, time: timeStr }
}

export function formatDateShort(d: Date | number | undefined | null): string {
  if (d == null) return ''
  const date = d instanceof Date ? d : new Date(d)
  return date.toLocaleString()
}
