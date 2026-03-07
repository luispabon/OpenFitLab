import type { Folder } from '../types/event';
import { apiFetch } from './client';

const API_BASE = '/api';

export async function getFolders(): Promise<Folder[]> {
  const response = await apiFetch(`${API_BASE}/folders`);
  if (!response.ok) {
    throw new Error(`Failed to fetch folders: ${response.statusText}`);
  }
  return response.json();
}

export async function getFolder(id: string): Promise<Folder> {
  const response = await apiFetch(`${API_BASE}/folders/${id}`);
  if (!response.ok) {
    if (response.status === 404) throw new Error('Folder not found');
    throw new Error(`Failed to fetch folder: ${response.statusText}`);
  }
  return response.json();
}

export interface CreateFolderBody {
  name: string;
  color: string;
}

export async function createFolder(body: CreateFolderBody): Promise<Folder> {
  const response = await apiFetch(`${API_BASE}/folders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(
      (data as { error?: string }).error || `Failed to create folder: ${response.statusText}`
    );
  }
  return response.json();
}

export interface UpdateFolderBody {
  name?: string;
  color?: string;
  pinned?: boolean;
}

export async function updateFolder(id: string, body: UpdateFolderBody): Promise<Folder> {
  const response = await apiFetch(`${API_BASE}/folders/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    if (response.status === 404) throw new Error('Folder not found');
    const data = await response.json().catch(() => ({}));
    throw new Error(
      (data as { error?: string }).error || `Failed to update folder: ${response.statusText}`
    );
  }
  return response.json();
}

export async function deleteFolder(
  id: string,
  contents: 'unfile' | 'delete' = 'unfile'
): Promise<void> {
  const response = await apiFetch(`${API_BASE}/folders/${id}?contents=${contents}`);
  if (!response.ok) {
    if (response.status === 404) throw new Error('Folder not found');
    throw new Error(`Failed to delete folder: ${response.statusText}`);
  }
}
