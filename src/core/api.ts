/**
 * Top-level convenience functions. Each accepts optional `CalendarOptions`
 * as its last argument; without options they use the default calendar:
 * government general + executive-order holidays, Friday/Saturday weekend,
 * national scope, English names.
 */
import { HolidayCalendar } from "./calendar";
import { todayInBangladesh, yearOf } from "./date-utils";
import type {
  CalendarSummary,
  DayInfo,
  HolidayStatistics,
  LeaveSuggestion,
  LongWeekend,
  MonthCalendar,
} from "../types/calendar";
import type { Holiday, HolidayCategory, HolidayType, ISODateString } from "../types/holiday";
import type {
  CalendarOptions,
  DateInput,
  DateRangeOptions,
  HolidayPage,
  HolidayQuery,
  LeaveSuggestionOptions,
  LongWeekendOptions,
  MonthCalendarOptions,
  UpcomingHolidayOptions,
} from "../types/options";

/** Options accepted by holiday listing functions: a query plus calendar configuration. */
export type GetHolidaysOptions = HolidayQuery & Omit<CalendarOptions, "year">;

let defaultCalendar: HolidayCalendar | undefined;

function hasKeys(options: object | undefined): boolean {
  return options !== undefined && Object.keys(options).length > 0;
}

function calendarFor(options?: CalendarOptions): HolidayCalendar {
  if (!hasKeys(options)) {
    defaultCalendar ??= new HolidayCalendar();
    return defaultCalendar;
  }
  return new HolidayCalendar(options);
}

const QUERY_KEYS = [
  "year",
  "month",
  "from",
  "to",
  "calendar",
  "category",
  "type",
  "dateStatus",
  "community",
  "dayType",
  "official",
  "search",
  "sort",
  "offset",
  "limit",
] as const;

function splitQuery(input: GetHolidaysOptions & { year?: number }): [HolidayQuery, CalendarOptions] {
  const query: Record<string, unknown> = {};
  const options: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    if ((QUERY_KEYS as readonly string[]).includes(key)) query[key] = value;
    else options[key] = value;
  }
  // Asking explicitly for optional holidays / observances implies including them.
  const categories = [query.category].flat();
  const types = [query.type].flat();
  if (categories.includes("optional") && options.includeOptionalHolidays === undefined) {
    options.includeOptionalHolidays = true;
  }
  if (
    (categories.includes("observance") || types.includes("observance")) &&
    options.includeObservances === undefined
  ) {
    options.includeObservances = true;
  }
  return [query, options];
}

function listing(input: GetHolidaysOptions): HolidayPage<Holiday> {
  const [query, options] = splitQuery(input);
  const year =
    query.year ??
    (query.from === undefined && query.to === undefined ? yearOf(todayInBangladesh()) : undefined);
  return calendarFor(options).queryHolidays(year === undefined ? query : { ...query, year });
}

/** Create a configured, immutable holiday calendar. */
export function createHolidayCalendar(options: CalendarOptions = {}): HolidayCalendar {
  return new HolidayCalendar(options);
}

/**
 * List holidays.
 *
 * ```ts
 * getHolidays(2027);
 * getHolidays(2027, { locale: "bn-BD", category: "general" });
 * getHolidays({ year: 2027, month: 3, calendar: "government", locale: "en" });
 * ```
 * With no argument, lists the current year (in Bangladesh time).
 */
export function getHolidays(year: number, options?: Omit<GetHolidaysOptions, "year">): readonly Holiday[];
export function getHolidays(query?: GetHolidaysOptions): readonly Holiday[];
export function getHolidays(
  yearOrQuery?: number | GetHolidaysOptions,
  options: Omit<GetHolidaysOptions, "year"> = {},
): readonly Holiday[] {
  const input = typeof yearOrQuery === "number" ? { ...options, year: yearOrQuery } : (yearOrQuery ?? {});
  return listing(input).items;
}

/** Paginated holiday listing (`{ items, total, offset, limit, hasMore }`). */
export function queryHolidays(query: GetHolidaysOptions = {}): HolidayPage<Holiday> {
  return listing(query);
}

/** The highest-precedence holiday on a date, or `undefined`. */
export function getHoliday(date: DateInput, options?: CalendarOptions): Holiday | undefined {
  return calendarFor(options).getHoliday(date);
}

/** All holidays on a date. */
export function getHolidaysOn(date: DateInput, options?: CalendarOptions): readonly Holiday[] {
  return calendarFor(options).getHolidaysOn(date);
}

export function getHolidayById(id: string, options?: CalendarOptions): Holiday | undefined {
  return calendarFor(options).getHolidayById(id);
}

export function isHoliday(date: DateInput, options?: CalendarOptions): boolean {
  return calendarFor(options).isHoliday(date);
}

export function getHolidaysByType(
  year: number,
  type: HolidayType | readonly HolidayType[],
  options?: Omit<GetHolidaysOptions, "year" | "type">,
): readonly Holiday[] {
  return getHolidays(year, { ...options, type });
}

export function getHolidaysByCategory(
  year: number,
  category: HolidayCategory | readonly HolidayCategory[],
  options?: Omit<GetHolidaysOptions, "year" | "category">,
): readonly Holiday[] {
  return getHolidays(year, { ...options, category });
}

export function getHolidaysByMonth(
  year: number,
  month: number,
  options?: Omit<GetHolidaysOptions, "year" | "month">,
): readonly Holiday[] {
  return getHolidays(year, { ...options, month });
}

export function getHolidayCount(
  yearOrQuery: number | GetHolidaysOptions,
  options: Omit<GetHolidaysOptions, "year"> = {},
): number {
  const input = typeof yearOrQuery === "number" ? { ...options, year: yearOrQuery } : yearOrQuery;
  return listing(input).total;
}

/** Holidays starting on/after `from` (default: today in Bangladesh). */
export function getUpcomingHolidays(
  from?: DateInput,
  options: UpcomingHolidayOptions & CalendarOptions = {},
): readonly Holiday[] {
  const { limit, inclusive, withinDays, ...calendarOptions } = options;
  return calendarFor(calendarOptions).getUpcomingHolidays(from, {
    ...(limit !== undefined ? { limit } : {}),
    ...(inclusive !== undefined ? { inclusive } : {}),
    ...(withinDays !== undefined ? { withinDays } : {}),
  });
}

export function getNextHoliday(
  date: DateInput,
  options: { inclusive?: boolean } & CalendarOptions = {},
): Holiday | undefined {
  const { inclusive, ...calendarOptions } = options;
  return calendarFor(calendarOptions).getNextHoliday(date, inclusive === undefined ? {} : { inclusive });
}

export function getPreviousHoliday(
  date: DateInput,
  options: { inclusive?: boolean } & CalendarOptions = {},
): Holiday | undefined {
  const { inclusive, ...calendarOptions } = options;
  return calendarFor(calendarOptions).getPreviousHoliday(date, inclusive === undefined ? {} : { inclusive });
}

export function getHolidayStatistics(year: number, options?: CalendarOptions): HolidayStatistics {
  return calendarFor(options).getHolidayStatistics(year);
}

export function getCalendarSummary(year: number, options?: CalendarOptions): CalendarSummary {
  return calendarFor(options).getCalendarSummary(year);
}

export function getDayInfo(date: DateInput, options?: CalendarOptions): DayInfo {
  return calendarFor(options).getDayInfo(date);
}

export function isWeekend(date: DateInput, options?: CalendarOptions): boolean {
  return calendarFor(options).isWeekend(date);
}

export function isBusinessDay(date: DateInput, options?: CalendarOptions): boolean {
  return calendarFor(options).isBusinessDay(date);
}

/** Alias of {@link isBusinessDay}. */
export function isWorkingDay(date: DateInput, options?: CalendarOptions): boolean {
  return calendarFor(options).isWorkingDay(date);
}

export function addBusinessDays(date: DateInput, days: number, options?: CalendarOptions): ISODateString {
  return calendarFor(options).addBusinessDays(date, days);
}

export function subtractBusinessDays(
  date: DateInput,
  days: number,
  options?: CalendarOptions,
): ISODateString {
  return calendarFor(options).subtractBusinessDays(date, days);
}

export function getNextBusinessDay(date: DateInput, options?: CalendarOptions): ISODateString {
  return calendarFor(options).getNextBusinessDay(date);
}

export function getPreviousBusinessDay(date: DateInput, options?: CalendarOptions): ISODateString {
  return calendarFor(options).getPreviousBusinessDay(date);
}

function splitRange(options: DateRangeOptions & CalendarOptions): [DateRangeOptions, CalendarOptions] {
  const { includeStart, includeEnd, ...calendarOptions } = options;
  return [
    {
      ...(includeStart !== undefined ? { includeStart } : {}),
      ...(includeEnd !== undefined ? { includeEnd } : {}),
    },
    calendarOptions,
  ];
}

/** Business days in `[start, end]`; both ends are included unless `includeStart`/`includeEnd` is false. */
export function countBusinessDays(
  start: DateInput,
  end: DateInput,
  options: DateRangeOptions & CalendarOptions = {},
): number {
  const [range, calendarOptions] = splitRange(options);
  return calendarFor(calendarOptions).countBusinessDays(start, end, range);
}

export function getBusinessDaysBetween(
  start: DateInput,
  end: DateInput,
  options: DateRangeOptions & CalendarOptions = {},
): readonly ISODateString[] {
  const [range, calendarOptions] = splitRange(options);
  return calendarFor(calendarOptions).getBusinessDaysBetween(start, end, range);
}

/** Business days in a month: `getWorkingDays(2027, 3)`; or a year: `getWorkingDays(2027)`. */
export function getWorkingDays(
  year: number,
  month?: number,
  options?: CalendarOptions,
): readonly ISODateString[];
export function getWorkingDays(year: number, options?: CalendarOptions): readonly ISODateString[];
export function getWorkingDays(
  year: number,
  monthOrOptions?: number | CalendarOptions,
  options?: CalendarOptions,
): readonly ISODateString[] {
  return typeof monthOrOptions === "number"
    ? calendarFor(options).getWorkingDays(year, monthOrOptions)
    : calendarFor(monthOrOptions).getWorkingDays(year);
}

/** Weekend dates in a month or year. */
export function getWeekendDays(
  year: number,
  month?: number,
  options?: CalendarOptions,
): readonly ISODateString[];
export function getWeekendDays(year: number, options?: CalendarOptions): readonly ISODateString[];
export function getWeekendDays(
  year: number,
  monthOrOptions?: number | CalendarOptions,
  options?: CalendarOptions,
): readonly ISODateString[] {
  return typeof monthOrOptions === "number"
    ? calendarFor(options).getWeekendDays(year, monthOrOptions)
    : calendarFor(monthOrOptions).getWeekendDays(year);
}

export function getLongWeekends(
  year: number,
  options: LongWeekendOptions & CalendarOptions = {},
): readonly LongWeekend[] {
  const { minDays, ...calendarOptions } = options;
  return calendarFor(calendarOptions).getLongWeekends(year, minDays === undefined ? {} : { minDays });
}

/**
 * Leave planner: the best business days to take off around holidays.
 *
 * ```ts
 * suggestLeave(2027, { maxLeaveDays: 2 });
 * // [{ leaveDates: ["2027-03-04"], startDate: "2027-03-04", endDate: "2027-03-13", daysOff: 10, … }, …]
 * ```
 */
export function suggestLeave(
  year: number,
  options: LeaveSuggestionOptions & CalendarOptions = {},
): readonly LeaveSuggestion[] {
  const { maxLeaveDays, minDaysOff, requireHoliday, limit, allowOverlap, ...calendarOptions } = options;
  return calendarFor(calendarOptions).suggestLeave(year, {
    ...(maxLeaveDays !== undefined ? { maxLeaveDays } : {}),
    ...(minDaysOff !== undefined ? { minDaysOff } : {}),
    ...(requireHoliday !== undefined ? { requireHoliday } : {}),
    ...(limit !== undefined ? { limit } : {}),
    ...(allowOverlap !== undefined ? { allowOverlap } : {}),
  });
}

/** Month grid (weeks × days) with holiday and business-day flags, for calendar UIs. */
export function getMonthCalendar(
  year: number,
  month: number,
  options: MonthCalendarOptions & CalendarOptions = {},
): MonthCalendar {
  const { weekStartsOn, bengaliDates, fixedWeeks, ...calendarOptions } = options;
  return calendarFor(calendarOptions).getMonthCalendar(year, month, {
    ...(weekStartsOn !== undefined ? { weekStartsOn } : {}),
    ...(bengaliDates !== undefined ? { bengaliDates } : {}),
    ...(fixedWeeks !== undefined ? { fixedWeeks } : {}),
  });
}
