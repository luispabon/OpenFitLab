import type { StreamData } from '../../lib/types/event';

/** Latitude + Longitude streams (zip by timestamp). */
export const streamsLatLngFixture: StreamData[] = [
  {
    type: 'Latitude',
    data: [
      { time: 1000, value: 40.7128 },
      { time: 2000, value: 40.713 },
      { time: 3000, value: 40.7132 },
    ],
  },
  {
    type: 'Longitude',
    data: [
      { time: 1000, value: -74.006 },
      { time: 2000, value: -74.005 },
      { time: 3000, value: -74.004 },
    ],
  },
];

/** Position stream (single stream with lat/lng objects). */
export const streamsPositionFixture: StreamData[] = [
  {
    type: 'Position',
    data: [
      { time: 0, value: { latitude: 40.7128, longitude: -74.006 } },
      { time: 1000, value: { latitude: 41.0, longitude: -73.0 } },
    ],
  },
];

/** No location data (e.g. Heart Rate only). */
export const streamsNoLocationFixture: StreamData[] = [
  {
    type: 'Heart Rate',
    data: [
      { time: 0, value: 120 },
      { time: 1000, value: 145 },
    ],
  },
];

export const emptyStreamsFixture: StreamData[] = [];
