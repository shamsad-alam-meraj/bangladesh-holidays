import type { DataCoverage } from "./dataset";
import type { CalendarId, Holiday, HolidayCategory, HolidayType, ISODateString, LocaleCode } from "./holiday";
import type { DateInterpretation, MissingDataPolicy, Weekday } from "./options";

/** Why a day is or is not a business day. */
export type DayStatusReason = "working-day-override" | "holiday" | "weekend" | "half-day" | "business-day";

/** Full classification of a single date. */
export interface DayInfo {
  readonly date: ISODateString;
  readonly weekday: Weekday;
  readonly isWeekend: boolean;
  /** Active holidays on the date (day-off and half-day; observances excluded). */
  readonly holidays: readonly Holiday[];
  /** Observances on the date (only when `includeObservances` is enabled). */
  readonly observances: readonly Holiday[];
  readonly isHoliday: boolean;
  readonly isHalfDay: boolean;
  readonly isWorkingDayOverride: boolean;
  readonly isBusinessDay: boolean;
  readonly reason: DayStatusReason;
}

/** A run of consecutive non-business days that contains at least one holiday. */
export interface LongWeekend {
  readonly startDate: ISODateString;
  readonly endDate: ISODateString;
  readonly days: number;
  readonly holidays: readonly Holiday[];
  /** True if the run continues into a year for which data is unavailable. */
  readonly truncated: boolean;
}

export interface CategoryStatistics {
  /** Number of holiday records. */
  readonly holidays: number;
  /** Number of holiday days (multi-day holidays count every day). */
  readonly days: number;
  /** Holiday days that fall on a weekly day off. */
  readonly weekendDays: number;
}

export interface HolidayStatistics {
  readonly year: number;
  readonly totalHolidays: number;
  readonly totalHolidayDays: number;
  readonly holidayDaysOnWeekends: number;
  /** Distinct dates with at least one active holiday. */
  readonly uniqueHolidayDates: number;
  /** Distinct holiday dates that are not weekend days — the effective extra days off. */
  readonly uniqueNonWeekendHolidayDates: number;
  readonly tentativeHolidays: number;
  readonly byCategory: Readonly<Partial<Record<HolidayCategory, CategoryStatistics>>>;
  readonly byType: Readonly<Partial<Record<HolidayType, number>>>;
  /** Distinct holiday dates per month, index 0 = January. */
  readonly byMonth: readonly number[];
  readonly calendarDays: number;
  readonly weekendDays: number;
  readonly businessDays: number;
}

export interface MonthSummary {
  readonly month: number;
  readonly holidays: readonly Holiday[];
  readonly businessDays: number;
  readonly weekendDays: number;
  readonly holidayDates: number;
}

export interface CalendarSummary {
  readonly year: number;
  readonly locale: LocaleCode;
  readonly weekend: readonly Weekday[];
  readonly calendars: readonly CalendarId[];
  readonly coverage: readonly DataCoverage[];
  readonly statistics: HolidayStatistics;
  readonly months: readonly MonthSummary[];
}

/** Fully resolved, frozen calendar configuration. */
export interface ResolvedCalendarOptions {
  readonly year: number | undefined;
  readonly locale: LocaleCode;
  readonly weekend: readonly Weekday[];
  readonly calendars: readonly CalendarId[];
  readonly includeOptionalHolidays: boolean;
  readonly optionalHolidayCommunities: readonly string[] | undefined;
  readonly includeObservances: boolean;
  readonly region: string | undefined;
  readonly halfDayIsBusinessDay: boolean;
  readonly onMissingData: MissingDataPolicy;
  readonly dateInterpretation: DateInterpretation;
  readonly excludedDates: readonly ISODateString[];
  readonly excludedHolidayIds: readonly string[];
  readonly workingDayOverrides: readonly ISODateString[];
}

/** A date on which two calendars disagree. */
export interface CalendarDifference {
  readonly date: ISODateString;
  readonly a: { readonly isBusinessDay: boolean; readonly holidayIds: readonly string[] };
  readonly b: { readonly isBusinessDay: boolean; readonly holidayIds: readonly string[] };
}

/** Several holidays active on the same date. */
export interface HolidayConflict {
  readonly date: ISODateString;
  readonly holidays: readonly Holiday[];
}

export interface FieldChange {
  readonly field: string;
  readonly before: unknown;
  readonly after: unknown;
}

export interface HolidayChangeSet<T> {
  readonly added: readonly T[];
  readonly removed: readonly T[];
  readonly changed: readonly {
    readonly id: string;
    readonly before: T;
    readonly after: T;
    readonly changes: readonly FieldChange[];
  }[];
  readonly unchanged: number;
}

/** A leave plan: the leave days to take and the break they produce. */
export interface LeaveSuggestion {
  /** First day off of the break. */
  readonly startDate: ISODateString;
  /** Last day off of the break. */
  readonly endDate: ISODateString;
  /** Total consecutive days off, including the leave days. */
  readonly daysOff: number;
  /** Business days to take as leave, in order. */
  readonly leaveDates: readonly ISODateString[];
  /** Number of leave days (`leaveDates.length`). */
  readonly leaveDays: number;
  /** Days off gained per leave day (`daysOff / leaveDays`). */
  readonly efficiency: number;
  /** Holidays inside the break. */
  readonly holidays: readonly Holiday[];
  /** True if the break reaches into a year for which data is unavailable. */
  readonly truncated: boolean;
}

/** One day in a month grid. */
export interface MonthCalendarDay {
  readonly date: ISODateString;
  /** Day of month (1–31). */
  readonly day: number;
  readonly weekday: Weekday;
  /** False for leading/trailing days that belong to the previous/next month. */
  readonly inMonth: boolean;
  readonly isWeekend: boolean;
  /** Holiday details are only filled for days in the month. */
  readonly holidays: readonly Holiday[];
  readonly isHoliday: boolean;
  readonly isHalfDay: boolean;
  /** `null` for days outside the month. */
  readonly isBusinessDay: boolean | null;
  /** Bangla calendar date (e.g. "১২ চৈত্র ১৪৩৩") from 14 April 2019 onward, else `undefined`. */
  readonly bengaliDate?: string;
}

/** Month view data for building calendar UIs. */
export interface MonthCalendar {
  readonly year: number;
  readonly month: number;
  readonly monthName: string;
  readonly locale: LocaleCode;
  /** Weekdays in column order, starting with `weekStartsOn`. */
  readonly weekdays: readonly {
    readonly weekday: Weekday;
    readonly name: string;
    readonly isWeekend: boolean;
  }[];
  /** Rows of exactly 7 days. */
  readonly weeks: readonly (readonly MonthCalendarDay[])[];
  readonly businessDays: number;
  readonly holidays: readonly Holiday[];
}
