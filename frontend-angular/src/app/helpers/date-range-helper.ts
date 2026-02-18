import { DateRanges, DaysOfTheWeek } from '@sports-alliance/sports-lib';

export interface DateRangeStartDateAndEndDate {
  startDate: Date | null;
  endDate: Date | null;
}

export function getDatesForDateRange(dateRange: DateRanges, startOfTheWeek: DaysOfTheWeek): DateRangeStartDateAndEndDate {
  const daysBack = new Date().getDay() >= startOfTheWeek ? 0 : 7;
  const firstDayOfTheWeek = new Date().getDate() - new Date().getDay() + startOfTheWeek;
  const lastDayOfTheWeek = firstDayOfTheWeek + 6;

  const fistDayOfTheWeekDate = new Date(new Date().setDate(firstDayOfTheWeek - daysBack));
  fistDayOfTheWeekDate.setHours(0, 0, 0);

  const lastDayOfTheWeekDate = new Date(new Date().setDate(lastDayOfTheWeek - daysBack));
  lastDayOfTheWeekDate.setHours(23, 59, 59);

  const firstDayOfLastWeekDate = new Date(new Date(fistDayOfTheWeekDate).setDate(fistDayOfTheWeekDate.getDate() - 7));
  firstDayOfLastWeekDate.setHours(0, 0, 0);

  const lastDayOfLastWeekDate = new Date(new Date(fistDayOfTheWeekDate.getTime()).setHours(0, 0, -1));

  switch (dateRange) {
    case DateRanges.thisWeek:
      return { startDate: fistDayOfTheWeekDate, endDate: lastDayOfTheWeekDate };
    case DateRanges.lastWeek:
      return { startDate: firstDayOfLastWeekDate, endDate: lastDayOfLastWeekDate };
    case DateRanges.lastSevenDays:
      return {
        startDate: new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() - 6),
        endDate: new Date(new Date().setHours(24, 0, 0, 0)),
      };
    case DateRanges.lastThirtyDays:
      return {
        startDate: new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() - 29),
        endDate: new Date(new Date().setHours(24, 0, 0, 0)),
      };
    case DateRanges.thisMonth:
      return {
        startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        endDate: new Date(new Date().setHours(24, 0, 0, 0)),
      };
    case DateRanges.lastMonth:
      return {
        startDate: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1),
        endDate: new Date(new Date(new Date().getFullYear(), new Date().getMonth(), 0).setHours(23, 59, 59)),
      };
    case DateRanges.thisYear:
      return {
        startDate: new Date(new Date().getFullYear(), 0, 1),
        endDate: new Date(new Date().setHours(24, 0, 0, 0)),
      };
    case DateRanges.lastYear:
      return {
        startDate: new Date(new Date().getFullYear() - 1, 0, 1),
        endDate: new Date(new Date(new Date().getFullYear(), 0, 0).setHours(23, 59, 59)),
      };
    default:
      return { startDate: null, endDate: null };
  }
}
