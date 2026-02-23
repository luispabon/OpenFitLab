import type { ActivityRow } from '../../lib/types/event';
import { eventSummaryFixture, activityFixture } from './event-detail';

export const activityRowFixture: ActivityRow = {
  event: eventSummaryFixture,
  activity: activityFixture,
};

export const activityRowsFixture: ActivityRow[] = [activityRowFixture];
