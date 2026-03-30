import { getActivityTypes, getDevices } from '../api';

export const metaState = $state({
  activityTypes: [] as string[],
  devices: [] as string[],

  activityTypesLoading: false,
  devicesLoading: false,

  activityTypesError: null as string | null,
  devicesError: null as string | null,

  activityTypesLoaded: false,
  devicesLoaded: false,
});

let activityTypesPromise: Promise<string[]> | null = null;
let devicesPromise: Promise<string[]> | null = null;

export async function ensureActivityTypes(): Promise<string[]> {
  if (metaState.activityTypesLoaded) return metaState.activityTypes;
  if (metaState.activityTypesLoading && activityTypesPromise) return activityTypesPromise;
  if (activityTypesPromise) return activityTypesPromise;

  metaState.activityTypesLoading = true;
  metaState.activityTypesError = null;

  activityTypesPromise = getActivityTypes()
    .then((list) => {
      metaState.activityTypes = list;
      metaState.activityTypesLoaded = true;
      return list;
    })
    .catch((e) => {
      const msg = e instanceof Error ? e.message : 'Failed to load activity types';
      metaState.activityTypesError = msg;
      metaState.activityTypes = [];
      metaState.activityTypesLoaded = false;
      return [];
    })
    .finally(() => {
      metaState.activityTypesLoading = false;
      activityTypesPromise = null;
    });

  return activityTypesPromise;
}

export async function ensureDevices(): Promise<string[]> {
  if (metaState.devicesLoaded) return metaState.devices;
  if (metaState.devicesLoading && devicesPromise) return devicesPromise;
  if (devicesPromise) return devicesPromise;

  metaState.devicesLoading = true;
  metaState.devicesError = null;

  devicesPromise = getDevices()
    .then((list) => {
      metaState.devices = list;
      metaState.devicesLoaded = true;
      return list;
    })
    .catch((e) => {
      const msg = e instanceof Error ? e.message : 'Failed to load devices';
      metaState.devicesError = msg;
      metaState.devices = [];
      metaState.devicesLoaded = false;
      return [];
    })
    .finally(() => {
      metaState.devicesLoading = false;
      devicesPromise = null;
    });

  return devicesPromise;
}

export async function ensureMetaLoaded(): Promise<void> {
  await Promise.all([ensureActivityTypes(), ensureDevices()]);
}
