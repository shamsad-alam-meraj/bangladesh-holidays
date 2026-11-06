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
