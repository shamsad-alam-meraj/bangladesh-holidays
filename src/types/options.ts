import type { HolidayDatasetInput } from "./dataset";
import type {
  CalendarId,
  Community,
  DateStatus,
  DayType,
  HolidayCategory,
  HolidaySource,
  HolidayType,
  ISODateString,
  LocaleCode,
  MetadataValue,
  RegionScope,
} from "./holiday";

/** A date argument: an ISO `YYYY-MM-DD` string (recommended) or a `Date` object. */
export type DateInput = ISODateString | Date;

/** Day of week, JavaScript convention: 0 = Sunday … 6 = Saturday. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * How `Date` objects are converted to calendar dates.
 * - `dhaka` (default) — the calendar date in Bangladesh (UTC+06:00) at that instant.
 * - `utc` — the UTC calendar date.
 * - `local` — the calendar date in the runtime's local time zone.
 *
 * ISO date strings are never affected by this setting.
 */
export type DateInterpretation = "dhaka" | "utc" | "local";

/**
 * What to do when a date falls in a year for which an enabled calendar has no data.
 * - `throw` (default) — throw `HolidayDataUnavailableError`. Prevents silently
 *   treating unknown holidays as working days.
 * - `ignore` — proceed as if that calendar has no holidays in that year.
 */
export type MissingDataPolicy = "throw" | "ignore";

/** A one-off custom holiday or closure. */
export interface CustomHolidayInput {
  /** Stable identifier. Defaults to `custom-<date>-<slug(name)>`. */
  readonly id?: string;
  readonly date: ISODateString;
  /** Inclusive end date for date-range closures. */
  readonly endDate?: ISODateString;
  readonly name: string;
  readonly nameBn?: string;
  readonly description?: string;
  readonly descriptionBn?: string;
  /** Defaults to `"custom"`. */
  readonly category?: HolidayCategory;
  /** Defaults to `"company"`. */
  readonly type?: HolidayType;
  /** Defaults to `"full"`. */
  readonly dayType?: DayType;
  readonly regions?: RegionScope;
  readonly substituteFor?: string;
  readonly metadata?: Readonly<Record<string, MetadataValue>>;
}

/** A holiday that repeats every year on the same Gregorian month/day. */
export interface RecurringHolidayInput {
  /** Base identifier; generated ids are `<id>-<year>`. */
  readonly id: string;
  /** 1–12. */
  readonly month: number;
  /** 1–31. A 29 February rule applies only in leap years. */
  readonly day: number;
  /** Number of consecutive days. Defaults to 1. */
  readonly durationDays?: number;
  readonly name: string;
  readonly nameBn?: string;
  readonly description?: string;
  readonly descriptionBn?: string;
  readonly category?: HolidayCategory;
  readonly type?: HolidayType;
  readonly dayType?: DayType;
  /** First year (inclusive) the rule applies. */
  readonly fromYear?: number;
  /** Last year (inclusive) the rule applies. */
  readonly toYear?: number;
  readonly metadata?: Readonly<Record<string, MetadataValue>>;
}

/**
 * Moves a dataset holiday to a different date, e.g. after the moon-sighting
 * committee shifts Eid. The holiday keeps its id and gains `dateStatus: "confirmed"`
 * unless another status is given.
 */
export interface HolidayDateOverride {
  readonly id: string;
  readonly date: ISODateString;
  readonly endDate?: ISODateString;
  readonly dateStatus?: DateStatus;
  readonly source?: HolidaySource;
}

/** Options accepted by `createHolidayCalendar()` and by every top-level function. */
export interface CalendarOptions {
  /** Default year for listing and export methods. */
  readonly year?: number;
  /** Display locale. Default `"en"`. */
  readonly locale?: LocaleCode;
  /** Weekly days off. Default `[5, 6]` (Friday, Saturday). */
  readonly weekend?: readonly Weekday[];
  /** Enabled calendar sources. Default `["government"]`. */
  readonly calendars?: readonly CalendarId[];
  /** Treat optional (ঐচ্ছিক) holidays as days off. Default `false`. */
  readonly includeOptionalHolidays?: boolean;
  /** Restrict optional holidays to these communities. Default: all communities. */
  readonly optionalHolidayCommunities?: readonly Community[];
  /** Include observances (never days off) in listings. Default `false`. */
  readonly includeObservances?: boolean;
  /**
   * Region (e.g. a district such as `"rangamati"`) used for regional holidays.
   * Default: national scope (holidays restricted to specific regions are excluded).
   * Use `"all"` to include every regional holiday.
   */
  readonly region?: string;
  /** Additional or replacement datasets (validated on load). */
  readonly datasets?: readonly HolidayDatasetInput[];
  readonly customHolidays?: readonly CustomHolidayInput[];
  readonly recurringHolidays?: readonly RecurringHolidayInput[];
  readonly holidayOverrides?: readonly HolidayDateOverride[];
  /** Dates on which all holidays are ignored (weekends still apply). */
  readonly excludedDates?: readonly ISODateString[];
  /** Holiday ids to ignore. */
  readonly excludedHolidayIds?: readonly string[];
  /** Dates that are always business days, even on weekends or holidays (highest precedence). */
  readonly workingDayOverrides?: readonly ISODateString[];
  /** Whether half-day holidays count as business days. Default `true`. */
  readonly halfDayIsBusinessDay?: boolean;
  /** Default `"throw"`. */
  readonly onMissingData?: MissingDataPolicy;
  /** Default `"dhaka"`. */
  readonly dateInterpretation?: DateInterpretation;
}

export type HolidaySortKey = "date" | "-date" | "name" | "-name" | "category";

/** Filters for holiday queries. All filters combine with AND; array values combine with OR. */
export interface HolidayFilter {
  readonly year?: number;
  /** 1–12; requires `year` (or the calendar's default year). */
  readonly month?: number;
  /** Inclusive lower bound (holidays overlapping the range are included). */
  readonly from?: DateInput;
  /** Inclusive upper bound. */
  readonly to?: DateInput;
  readonly calendar?: CalendarId | readonly CalendarId[];
  readonly category?: HolidayCategory | readonly HolidayCategory[];
  readonly type?: HolidayType | readonly HolidayType[];
  readonly dateStatus?: DateStatus | readonly DateStatus[];
  readonly community?: Community | readonly Community[];
  readonly dayType?: DayType;
  readonly official?: boolean;
  /** Case-insensitive match on id, English name and Bangla name. */
  readonly search?: string;
}

export interface HolidayQuery extends HolidayFilter {
  readonly sort?: HolidaySortKey;
  readonly offset?: number;
  readonly limit?: number;
}

export interface HolidayPage<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly offset: number;
  readonly limit: number;
  readonly hasMore: boolean;
}

/** Which ends of a date range are counted. */
export interface DateRangeOptions {
  /** Default `true`. */
  readonly includeStart?: boolean;
  /** Default `true`. */
  readonly includeEnd?: boolean;
}

export interface LongWeekendOptions {
  /** Minimum run length in days. Default `3`. */
  readonly minDays?: number;
}

export interface UpcomingHolidayOptions {
  /** Maximum number of results. Default `5`. */
  readonly limit?: number;
  /** Include a holiday that falls on the start date. Default `true`. */
  readonly inclusive?: boolean;
  /** Only include holidays starting within this many days. */
  readonly withinDays?: number;
}
