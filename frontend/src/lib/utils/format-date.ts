export interface FormattedDate {
  date: string;
  time: string;
}

export function formatDate(d: Date | number | undefined | null): FormattedDate {
  if (d == null) return { date: '', time: '' };
  const date = d instanceof Date ? d : new Date(d);
  const dateStr = date.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const timeStr = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
  return { date: dateStr, time: timeStr };
}

export function formatDateShort(d: Date | number | undefined | null): string {
  if (d == null) return '';
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleString();
}

export function formatDateWithTime(d: Date | number | undefined | null): string {
  if (d == null) return '';
  const date = d instanceof Date ? d : new Date(d);
  const dateStr = date.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const timeStr = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${dateStr} at ${timeStr}`;
}

/**
 * Format date with original timezone if available, otherwise use browser local time.
 * When originalTimezone is set, shows time in that zone; if different from local, appends local time.
 */
export function formatDateWithOriginalTimezone(ms: number, originalTimezone?: string): string {
  if (!ms) return '';

  const date = new Date(ms);

  if (!originalTimezone) {
    return formatDateWithTime(date);
  }

  try {
    const originalDateStr = date.toLocaleDateString('en-US', {
      timeZone: originalTimezone,
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    const originalTimeStr = date.toLocaleTimeString('en-US', {
      timeZone: originalTimezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZoneName: 'short',
    });
    const originalTimeOnly = date.toLocaleTimeString('en-US', {
      timeZone: originalTimezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const localDateStr = date.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    const localTimeStr = date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const primary = `${originalDateStr} at ${originalTimeStr}`;
    if (originalDateStr === localDateStr && originalTimeOnly === localTimeStr) {
      return primary;
    }
    return `${primary} (local: ${localDateStr} at ${localTimeStr})`;
  } catch {
    return formatDateWithTime(date);
  }
}
