import { apiFetch } from './client';

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function downloadEventTcx(eventId: string, filename: string): Promise<void> {
  const res = await apiFetch(`/api/events/${eventId}/export/tcx`);
  if (!res.ok) throw new Error(`TCX export failed: ${res.statusText}`);
  const blob = await res.blob();
  triggerDownload(blob, `${filename}.tcx`);
}

export async function downloadEventGpx(eventId: string, filename: string): Promise<void> {
  const res = await apiFetch(`/api/events/${eventId}/export/gpx`);
  if (!res.ok) throw new Error(`GPX export failed: ${res.statusText}`);
  const blob = await res.blob();
  triggerDownload(blob, `${filename}.gpx`);
}
