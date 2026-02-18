import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, ResolveFn, RouterStateSnapshot } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { EventInterface, User, ActivityTypes, DateRanges } from '@sports-alliance/sports-lib';
import { ApiEventService } from '../services/api-event.service';
import { AppAuthService } from '../auth/app.auth.service';
import { getDatesForDateRange } from '../helpers/date-range-helper';
import { DaysOfTheWeek } from '@sports-alliance/sports-lib';

export interface DashboardResolverData {
  events: EventInterface[];
  user: User | null;
}

export const dashboardResolver: ResolveFn<DashboardResolverData> = async (
  _route: ActivatedRouteSnapshot,
  _state: RouterStateSnapshot
) => {
  const eventService = inject(ApiEventService);
  const authService = inject(AppAuthService);
  const user = await firstValueFrom(authService.user$);
  if (!user) return { events: [], user: null };

  const where: { fieldPath: string; opStr: string; value: number }[] = [];
  const settings = user.settings as { dashboardSettings?: { dateRange?: DateRanges; startDate?: number; endDate?: number; activityTypes?: ActivityTypes[] }; unitSettings?: { startOfTheWeek?: number } };
  
  // If no dashboard settings, use defaults instead of returning empty
  if (settings?.dashboardSettings) {
    const dateRange = settings.dashboardSettings.dateRange ?? DateRanges.lastThirtyDays;
    const startOfTheWeek = (settings.unitSettings?.startOfTheWeek ?? DaysOfTheWeek.Monday) as DaysOfTheWeek;
    if (dateRange === DateRanges.custom && settings.dashboardSettings.startDate && settings.dashboardSettings.endDate) {
      where.push({ fieldPath: 'startDate', opStr: '>=', value: settings.dashboardSettings.startDate });
      where.push({ fieldPath: 'startDate', opStr: '<=', value: settings.dashboardSettings.endDate });
    } else if (dateRange !== DateRanges.all) {
      const range = getDatesForDateRange(dateRange, startOfTheWeek);
      if (range.startDate && range.endDate) {
        where.push({ fieldPath: 'startDate', opStr: '>=', value: range.startDate.getTime() });
        where.push({ fieldPath: 'startDate', opStr: '<=', value: range.endDate.getTime() });
      }
    }
  }
  // If no dashboard settings, fetch all events (no date filtering)

  const limit = 200;
  let events: EventInterface[] = [];
  try {
    events = await firstValueFrom(eventService.getEventsOnceBy(user, where, 'startDate', false, limit));
  } catch (error) {
    console.error('Error fetching events in dashboard resolver:', error);
    return { events: [], user };
  }

  const activityTypes = settings?.dashboardSettings?.activityTypes;
  if (activityTypes?.length) {
    events = events.filter((event) =>
      event.getActivityTypesAsArray().some((t) => activityTypes.indexOf(ActivityTypes[t as keyof typeof ActivityTypes]) >= 0)
    );
  }

  return { events, user };
};
