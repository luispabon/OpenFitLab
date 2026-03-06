import type { EventDetail, EventSummary, Activity } from '../../lib/types/event';

const activityFixture = {
  id: 'act-1',
  eventID: 'evt-1',
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

const activityEvt2Fixture = {
  ...activityFixture,
  id: 'act-2',
  eventID: 'evt-2',
  name: 'Evening Run',
  deviceName: 'Wahoo Elemnt',
} satisfies Activity;

const eventSummaryEvt2Fixture = {
  ...eventSummaryFixture,
  id: 'evt-2',
  name: 'Evening Run',
} satisfies EventSummary;

/** Second event detail for comparison-view tests (evt-2, Evening Run, Wahoo Elemnt). */
export const eventDetailEvt2Fixture = {
  event: eventSummaryEvt2Fixture,
  activities: [activityEvt2Fixture],
} satisfies EventDetail;

export { eventSummaryFixture, activityFixture };
