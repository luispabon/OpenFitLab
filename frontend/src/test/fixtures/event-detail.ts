import type { EventDetail, EventSummary, Activity } from '../../lib/types/event';

const activityFixture = {
  id: 'act-1',
  eventID: 'evt-1',
  eventStartDate: 1700000000000,
  name: 'Morning Run',
  startDate: 1700000000000,
  endDate: 1700003600000,
  type: 'running',
  stats: {
    Duration: 3600,
    Distance: 10000,
    'Average Speed in Kilometers per Hour': 10,
    'Average Heart Rate': 145,
  },
  deviceName: 'Garmin Forerunner 945',
} satisfies Activity;

const eventSummaryFixture = {
  id: 'evt-1',
  name: 'Morning Run',
  startDate: 1700000000000,
  endDate: 1700003600000,
  stats: {
    Duration: 3600,
    Distance: 10000,
    'Average Speed in Kilometers per Hour': 10,
    'Average Heart Rate': 145,
  },
  srcFileType: 'fit',
} satisfies EventSummary;

export const eventDetailFixture = {
  event: eventSummaryFixture,
  activities: [activityFixture],
} satisfies EventDetail;

export { eventSummaryFixture, activityFixture };
