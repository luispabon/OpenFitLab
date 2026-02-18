import { User, Privacy, DateRanges, DaysOfTheWeek } from '@sports-alliance/sports-lib';

const LOCAL_UID = 'local';

function buildLocalUser(): User {
  const u = new User(LOCAL_UID, 'Local User', undefined, Privacy.Private);
  (u as User & { settings: unknown }).settings = {
    dashboardSettings: {
      dateRange: DateRanges.lastThirtyDays,
      startDate: 0,
      endDate: 0,
      tiles: [],
      tableSettings: {
        eventsPerPage: 10,
        active: 'startDate',
        direction: 'desc',
        selectedColumns: [],
      },
      activityTypes: [],
    },
    unitSettings: {
      speedUnits: [],
      gradeAdjustedSpeedUnits: [],
      verticalSpeedUnits: [],
      paceUnits: [],
      gradeAdjustedPaceUnits: [],
      swimPaceUnits: [],
      startOfTheWeek: DaysOfTheWeek.Monday,
    },
    chartSettings: { showAllData: false, dataTypeSettings: {} },
  } as unknown as User['settings'];
  return u;
}

export const LOCAL_USER: User = buildLocalUser();
export { LOCAL_UID };
