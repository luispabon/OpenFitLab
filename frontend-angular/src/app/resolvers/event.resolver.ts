import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, ResolveFn, Router } from '@angular/router';
import { EventInterface, User } from '@sports-alliance/sports-lib';
import { DataLatitudeDegrees, DataLongitudeDegrees, DataSpeed, DataGradeAdjustedSpeed, DataDistance, DynamicDataLoader } from '@sports-alliance/sports-lib';
import { map, catchError, switchMap, take } from 'rxjs/operators';
import { of } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ApiEventService } from '../services/api-event.service';
import { AppAuthService } from '../auth/app.auth.service';
import { AppUserService } from '../services/app.user.service';
import { LOCAL_USER } from '../constants/single-user';

export interface EventResolverData {
  event: EventInterface;
  user: User | null;
}

export const eventResolver: ResolveFn<EventResolverData | null> = (route: ActivatedRouteSnapshot) => {
  const eventService = inject(ApiEventService);
  const authService = inject(AppAuthService);
  const userService = inject(AppUserService);
  const router = inject(Router);
  const snackBar = inject(MatSnackBar);

  const eventID = route.paramMap.get('id');
  if (!eventID) {
    router.navigate(['/dashboard']);
    return of(null);
  }

  return authService.user$.pipe(
    take(1),
    switchMap((user) => {
      const u = user ?? LOCAL_USER;
      const dataTypes = [
    DataLatitudeDegrees.type,
    DataLongitudeDegrees.type,
    DataSpeed.type,
    DataGradeAdjustedSpeed.type,
    DataDistance.type,
    'Heart Rate', // Heart rate stream
  ];
  const userChartDataTypes = userService.getUserChartDataTypesToUse(u);
  const nonUnitBased = DynamicDataLoader.getNonUnitBasedDataTypes(
    (u.settings as { chartSettings?: { showAllData?: boolean } })?.chartSettings?.showAllData ?? false,
    userChartDataTypes
  );
  nonUnitBased.forEach((t) => {
    if (!dataTypes.includes(t)) dataTypes.push(t);
  });

  return eventService.getEventActivitiesAndSomeStreams(u, eventID, dataTypes).pipe(
    map((event) => (event ? { event, user: u } : null))
  );
    }),
    catchError((_err) => {
      snackBar.open('Event not found', 'Close', { duration: 3000 });
      router.navigate(['/dashboard']);
      return of(null);
    })
  );
};
