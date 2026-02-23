import type { Comparison } from '../../lib/types/event';

export const comparisonFixture = {
  id: 'cmp-1',
  name: 'Run vs Ride',
  eventIds: ['evt-1', 'evt-2'],
  createdAt: 1700000000000,
} satisfies Comparison;

export const comparisonWithSettingsFixture = {
  id: 'cmp-2',
  name: 'Detailed comparison',
  eventIds: ['evt-1', 'evt-2'],
  settings: {
    selectedStreams: ['Heart Rate', 'Speed'],
    xAxisMode: 'elapsed' as const,
    selectedActivities: { 'evt-1': 'act-1', 'evt-2': 'act-2' },
  },
  createdAt: 1700000000000,
} satisfies Comparison;
