import { BUILT_IN_CALENDARS, BUILT_IN_COVERAGE, BUILT_IN_DATASETS } from "../data";
import { exportToCsv } from "../exporters/csv";
import { exportToIcs } from "../exporters/ics";
import { exportToJson } from "../exporters/json";
import { getMonthName, getWeekdayName, isBanglaLocale, isSupportedLocale } from "../localization";
import { BENGALI_CALENDAR_MIN_DATE, formatBengaliDate } from "../localization/bengali-calendar";
import { matchesAttributes, overlapsRange, regionApplies } from "../utils/filtering";
import { deepFreeze } from "../utils/freeze";
import { CATEGORY_PRIORITY, compareByPrecedence, compareHolidays, sortHolidays } from "../utils/sorting";
import {
  addDays,
  compareISODates,
  assertMonth,
  assertYear,
  daysInMonth,
  daysInYear,
  endOfYear,
  formatISODate,
  fromDayNumber,
  getWeekday,
  isLeapYear,
  isValidISODate,
  monthOf,
  startOfYear,
  toDayNumber,
  toISODate,
  todayInBangladesh,
  yearOf,
} from "./date-utils";
import { ConfigurationError, HolidayDataUnavailableError } from "./errors";
import { localizeHoliday } from "./localize";
import { COMMUNITIES, DAY_TYPES, HOLIDAY_CATEGORIES, HOLIDAY_TYPES, normalizeDataset } from "./validation";
import type {
  CalendarSummary,
  CategoryStatistics,
  DayInfo,
  HolidayStatistics,
  LeaveSuggestion,
  LongWeekend,
  MonthCalendar,
  MonthCalendarDay,
  MonthSummary,
  ResolvedCalendarOptions,
} from "../types/calendar";
import type { DataCoverage, HolidayDataset } from "../types/dataset";
import type { ExportFormat, CsvExportOptions, IcsExportOptions, JsonExportOptions } from "../types/export";
import type {
  CalendarId,
  Holiday,
  HolidayCategory,
  HolidayRecord,
  HolidayType,
  ISODateString,
  LocaleCode,
} from "../types/holiday";
import type {
  CalendarOptions,
  CustomHolidayInput,
  DateInput,
  DateRangeOptions,
  HolidayDateOverride,
  HolidayPage,
  HolidayQuery,
  LeaveSuggestionOptions,
  LongWeekendOptions,
  MonthCalendarOptions,
  RecurringHolidayInput,
  UpcomingHolidayOptions,
  Weekday,
} from "../types/options";

/** Safety limit for business-day searches (~100 years). */
const MAX_SEARCH_DAYS = 36_600;
const ID_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;

interface YearIndex {
  readonly year: number;
  /** Active (non-observance) holidays overlapping the year, sorted. */
  readonly holidays: readonly Holiday[];
  readonly observances: readonly Holiday[];
  /** Day → active holidays (excluded dates removed), for dates inside the year. */
  readonly byDate: ReadonlyMap<ISODateString, readonly Holiday[]>;
  readonly observancesByDate: ReadonlyMap<ISODateString, readonly Holiday[]>;
}

function datasetKey(calendar: CalendarId, year: number): string {
  return `${calendar}:${year}`;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function frozenList<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...items]);
}

function requireDate(value: unknown, label: string): ISODateString {
  if (!isValidISODate(value)) {
    throw new ConfigurationError(`${label} must be a valid YYYY-MM-DD date; got ${JSON.stringify(value)}`);
  }
  return value;
}

function requireEnum<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) {
    throw new ConfigurationError(
      `${label} must be one of ${allowed.join(", ")}; got ${JSON.stringify(value)}`,
    );
  }
  return value as T;
}

/**
 * A configured holiday calendar. Instances are immutable: the `with*`/`add*`
 * methods return new calendars.
 *
 * Precedence for deciding whether a date is a business day (highest first):
 * 1. `workingDayOverrides` — always a business day.
 * 2. Full-day holidays — not a business day. Holidays come from enabled
 *    datasets (after `holidayOverrides` move them), custom and recurring
 *    holidays; `excludedDates` and `excludedHolidayIds` remove holidays.
 * 3. Weekend days — not a business day.
 * 4. Half-day holidays — business day unless `halfDayIsBusinessDay: false`.
 * 5. Otherwise a business day.
 */
export class HolidayCalendar {
  /** Resolved, frozen configuration. */
  readonly options: ResolvedCalendarOptions;
  private readonly config: CalendarOptions;
  private readonly datasets = new Map<string, HolidayDataset>();
  private readonly knownCalendars: ReadonlySet<CalendarId>;
  private readonly customRecords: readonly HolidayRecord[];
  private readonly recurring: readonly RecurringHolidayInput[];
  private readonly overrides: ReadonlyMap<string, HolidayDateOverride>;
  private readonly weekendSet: ReadonlySet<number>;
  private readonly excludedDateSet: ReadonlySet<ISODateString>;
  private readonly excludedIdSet: ReadonlySet<string>;
  private readonly workingOverrideSet: ReadonlySet<ISODateString>;
  private readonly cache = new Map<number, YearIndex>();

  constructor(options: CalendarOptions = {}) {
    if (typeof options !== "object" || options === null) {
      throw new ConfigurationError("Calendar options must be an object");
    }
    this.config = options;
    const year = options.year;
    if (year !== undefined) assertYear(year);

    const locale = options.locale ?? "en";
    if (!isSupportedLocale(locale)) {
      throw new ConfigurationError(
        `Unsupported locale ${JSON.stringify(locale)}; use en, en-BD, bn or bn-BD`,
      );
    }

    const weekendInput: unknown = options.weekend ?? [5, 6];
    if (!Array.isArray(weekendInput))
      throw new ConfigurationError("weekend must be an array of weekdays 0–6");
    const weekend = weekendInput as Weekday[];
    for (const day of weekend) {
      if (!Number.isInteger(day) || day < 0 || day > 6) {
        throw new ConfigurationError(
          `weekend days must be integers 0 (Sunday) to 6 (Saturday); got ${String(day)}`,
        );
      }
    }
    const weekendSet = new Set<number>(weekend);
    if (weekendSet.size !== weekend.length) throw new ConfigurationError("weekend contains duplicate days");
    if (weekendSet.size === 7) throw new ConfigurationError("weekend cannot contain all seven days");
    this.weekendSet = weekendSet;

    // Datasets: built-ins first, then custom datasets (which may replace a built-in calendar/year).
    for (const dataset of BUILT_IN_DATASETS)
      this.datasets.set(datasetKey(dataset.calendar, dataset.year), dataset);
    const customCalendars = new Set<CalendarId>();
    const seenCustom = new Set<string>();
    (options.datasets ?? []).forEach((input, index) => {
      const dataset = normalizeDataset(input, `datasets[${index}]`);
      const key = datasetKey(dataset.calendar, dataset.year);
      if (seenCustom.has(key)) {
        throw new ConfigurationError(`Two custom datasets provided for ${dataset.calendar} ${dataset.year}`);
      }
      seenCustom.add(key);
      customCalendars.add(dataset.calendar);
      this.datasets.set(key, dataset);
    });
    this.knownCalendars = new Set<CalendarId>([...BUILT_IN_CALENDARS.map((c) => c.id), ...customCalendars]);

    const calendars = [...(options.calendars ?? ["government"])];
    for (const calendar of customCalendars) if (!calendars.includes(calendar)) calendars.push(calendar);
    for (const calendar of calendars) {
      if (!this.knownCalendars.has(calendar)) {
        throw new ConfigurationError(
          `Unknown calendar ${JSON.stringify(calendar)}. Known calendars: ${[...this.knownCalendars].join(", ")}. Custom holidays do not need a calendar entry.`,
        );
      }
    }
    if (new Set(calendars).size !== calendars.length)
      throw new ConfigurationError("calendars contains duplicates");

    const communities = options.optionalHolidayCommunities;
    if (communities !== undefined) {
      communities.forEach((c) => requireEnum(c, COMMUNITIES, "optionalHolidayCommunities[]"));
    }
    const region = options.region === undefined ? undefined : options.region.trim().toLowerCase();
    if (region === "") throw new ConfigurationError("region must be a non-empty string");

    const onMissingData = requireEnum(
      options.onMissingData ?? "throw",
      ["throw", "ignore"] as const,
      "onMissingData",
    );
    const dateInterpretation = requireEnum(
      options.dateInterpretation ?? "dhaka",
      ["dhaka", "utc", "local"] as const,
      "dateInterpretation",
    );

    const excludedDates = (options.excludedDates ?? []).map((d, i) => requireDate(d, `excludedDates[${i}]`));
    const workingDayOverrides = (options.workingDayOverrides ?? []).map((d, i) =>
      requireDate(d, `workingDayOverrides[${i}]`),
    );
    this.excludedDateSet = new Set(excludedDates);
    this.workingOverrideSet = new Set(workingDayOverrides);

    this.customRecords = deepFreeze(this.buildCustomRecords(options.customHolidays ?? []));
    this.recurring = deepFreeze(
      (options.recurringHolidays ?? []).map((rule, i) => this.checkRecurring(rule, i)),
    );

    // Every id that could exist, to validate overrides and exclusions.
    const datasetIds = new Set<string>();
    for (const dataset of this.datasets.values())
      for (const record of dataset.holidays) datasetIds.add(record.id);
    const customIds = new Set(this.customRecords.map((record) => record.id));
    const recurringIds = new Set(this.recurring.map((rule) => rule.id));
    for (const id of customIds) {
      if (datasetIds.has(id))
        throw new ConfigurationError(`Custom holiday id "${id}" collides with a dataset holiday`);
    }
    for (const id of recurringIds) {
      if (datasetIds.has(id) || customIds.has(id)) {
        throw new ConfigurationError(`Recurring holiday id "${id}" collides with another holiday id`);
      }
    }

    const overrides = new Map<string, HolidayDateOverride>();
    (options.holidayOverrides ?? []).forEach((override, i) => {
      if (typeof override?.id !== "string")
        throw new ConfigurationError(`holidayOverrides[${i}].id is required`);
      if (overrides.has(override.id)) {
        throw new ConfigurationError(
          `Conflicting holidayOverrides: "${override.id}" is overridden more than once`,
        );
      }
      if (!datasetIds.has(override.id)) {
        throw new ConfigurationError(
          `holidayOverrides[${i}] refers to unknown dataset holiday "${override.id}"`,
        );
      }
      const date = requireDate(override.date, `holidayOverrides[${i}].date`);
      if (
        override.endDate !== undefined &&
        requireDate(override.endDate, `holidayOverrides[${i}].endDate`) < date
      ) {
        throw new ConfigurationError(`holidayOverrides[${i}].endDate is before date`);
      }
      if (override.dateStatus !== undefined) {
        requireEnum(
          override.dateStatus,
          ["scheduled", "tentative", "confirmed", "estimated"] as const,
          "dateStatus",
        );
      }
      overrides.set(override.id, deepFreeze({ ...override }));
    });
    this.overrides = overrides;

    const excludedHolidayIds = [...(options.excludedHolidayIds ?? [])];
    for (const id of excludedHolidayIds) {
      const recurringMatch = [...recurringIds].some(
        (base) => id === base || new RegExp(`^${base.replace(/[.]/g, "\\.")}-\\d{4}$`).test(id),
      );
      if (!datasetIds.has(id) && !customIds.has(id) && !recurringMatch) {
        throw new ConfigurationError(`excludedHolidayIds contains unknown holiday id "${id}"`);
      }
    }
    this.excludedIdSet = new Set(excludedHolidayIds);

    // A date cannot be both an explicit working day and an explicit custom holiday.
    for (const record of this.customRecords) {
      for (const date of workingDayOverrides) {
        if (date >= record.date && date <= (record.endDate ?? record.date)) {
          throw new ConfigurationError(
            `Conflicting configuration: ${date} is listed in workingDayOverrides and is also custom holiday "${record.id}"`,
          );
        }
      }
    }

    this.options = deepFreeze({
      year,
      locale,
      weekend: [...weekend].sort((a, b) => a - b),
      calendars,
      includeOptionalHolidays: options.includeOptionalHolidays ?? false,
      optionalHolidayCommunities: communities ? [...communities] : undefined,
      includeObservances: options.includeObservances ?? false,
      region,
      halfDayIsBusinessDay: options.halfDayIsBusinessDay ?? true,
      onMissingData,
      dateInterpretation,
      excludedDates: [...excludedDates].sort(),
      excludedHolidayIds: [...excludedHolidayIds].sort(),
      workingDayOverrides: [...workingDayOverrides].sort(),
    });
  }

  // ---------------------------------------------------------------------------
  // Configuration
  // ---------------------------------------------------------------------------

  private buildCustomRecords(inputs: readonly CustomHolidayInput[]): HolidayRecord[] {
    const ids = new Set<string>();
    return inputs.map((input, index) => {
      const label = `customHolidays[${index}]`;
      if (typeof input !== "object" || input === null)
        throw new ConfigurationError(`${label} must be an object`);
      const date = requireDate(input.date, `${label}.date`);
      const endDate =
        input.endDate === undefined ? undefined : requireDate(input.endDate, `${label}.endDate`);
      if (endDate !== undefined && endDate < date)
        throw new ConfigurationError(`${label}.endDate is before date`);
      if (typeof input.name !== "string" || input.name.trim() === "") {
        throw new ConfigurationError(`${label}.name must be a non-empty string`);
      }
      const category = requireEnum(input.category ?? "custom", HOLIDAY_CATEGORIES, `${label}.category`);
      const type = requireEnum(input.type ?? "company", HOLIDAY_TYPES, `${label}.type`);
      const dayType = requireEnum(input.dayType ?? "full", DAY_TYPES, `${label}.dayType`);
      const slug = slugify(input.name);
      const id = input.id ?? `custom-${date}-${slug || String(index + 1)}`;
      if (!ID_PATTERN.test(id))
        throw new ConfigurationError(`${label}.id must be lowercase letters, digits, ".", "_" or "-"`);
      if (ids.has(id)) throw new ConfigurationError(`Duplicate custom holiday id "${id}"`);
      ids.add(id);
      const record: HolidayRecord = {
        id,
        nameEn: input.name,
        ...(input.nameBn !== undefined ? { nameBn: input.nameBn } : {}),
        date,
        ...(endDate !== undefined && endDate !== date ? { endDate } : {}),
        category,
        type,
        calendar: "custom",
        dayType,
        dateStatus: "scheduled",
        official: false,
        verification: "unverified",
        ...(input.description !== undefined ? { descriptionEn: input.description } : {}),
        ...(input.descriptionBn !== undefined ? { descriptionBn: input.descriptionBn } : {}),
        ...(input.regions !== undefined ? { regions: input.regions } : {}),
        ...(input.substituteFor !== undefined ? { substituteFor: input.substituteFor } : {}),
        ...(input.metadata !== undefined ? { metadata: { ...input.metadata } } : {}),
      };
      return record;
    });
  }

  private checkRecurring(rule: RecurringHolidayInput, index: number): RecurringHolidayInput {
    const label = `recurringHolidays[${index}]`;
    if (typeof rule !== "object" || rule === null) throw new ConfigurationError(`${label} must be an object`);
    if (typeof rule.id !== "string" || !ID_PATTERN.test(rule.id)) {
      throw new ConfigurationError(`${label}.id must be lowercase letters, digits, ".", "_" or "-"`);
    }
    if (!Number.isInteger(rule.month) || rule.month < 1 || rule.month > 12) {
      throw new ConfigurationError(`${label}.month must be 1–12`);
    }
    if (!Number.isInteger(rule.day) || rule.day < 1 || rule.day > daysInMonth(2024, rule.month)) {
      throw new ConfigurationError(`${label}.day is out of range for month ${rule.month}`);
    }
    const duration = rule.durationDays ?? 1;
    if (!Number.isInteger(duration) || duration < 1 || duration > 366) {
      throw new ConfigurationError(`${label}.durationDays must be an integer 1–366`);
    }
    if (typeof rule.name !== "string" || rule.name.trim() === "") {
      throw new ConfigurationError(`${label}.name must be a non-empty string`);
    }
    if (rule.fromYear !== undefined) assertYear(rule.fromYear, `${label}.fromYear`);
    if (rule.toYear !== undefined) assertYear(rule.toYear, `${label}.toYear`);
    if (rule.fromYear !== undefined && rule.toYear !== undefined && rule.toYear < rule.fromYear) {
      throw new ConfigurationError(`${label}.toYear is before fromYear`);
    }
    requireEnum(rule.category ?? "custom", HOLIDAY_CATEGORIES, `${label}.category`);
    requireEnum(rule.type ?? "company", HOLIDAY_TYPES, `${label}.type`);
    requireEnum(rule.dayType ?? "full", DAY_TYPES, `${label}.dayType`);
    return { ...rule };
  }

  /** The options this calendar was created with (for serialization or cloning). */
  getConfig(): CalendarOptions {
    return this.config;
  }

  /** Return a new calendar with some options replaced. */
  with(options: Partial<CalendarOptions>): HolidayCalendar {
    return new HolidayCalendar({ ...this.config, ...options });
  }

  setYear(year: number): HolidayCalendar {
    return this.with({ year });
  }

  setLocale(locale: LocaleCode): HolidayCalendar {
    return this.with({ locale });
  }

  setWeekend(weekend: readonly Weekday[]): HolidayCalendar {
    return this.with({ weekend });
  }

  addCustomHolidays(...holidays: CustomHolidayInput[]): HolidayCalendar {
    return this.with({ customHolidays: [...(this.config.customHolidays ?? []), ...holidays] });
  }

  addRecurringHolidays(...rules: RecurringHolidayInput[]): HolidayCalendar {
    return this.with({ recurringHolidays: [...(this.config.recurringHolidays ?? []), ...rules] });
  }

  addWorkingDayOverrides(...dates: ISODateString[]): HolidayCalendar {
    return this.with({ workingDayOverrides: [...(this.config.workingDayOverrides ?? []), ...dates] });
  }

  addExcludedDates(...dates: ISODateString[]): HolidayCalendar {
    return this.with({ excludedDates: [...(this.config.excludedDates ?? []), ...dates] });
  }

  excludeHolidays(...ids: string[]): HolidayCalendar {
    return this.with({ excludedHolidayIds: [...(this.config.excludedHolidayIds ?? []), ...ids] });
  }

  /** Move dataset holidays (e.g. after moon sighting). Replaces earlier overrides for the same id. */
  overrideHolidayDates(...overrides: HolidayDateOverride[]): HolidayCalendar {
    const ids = new Set(overrides.map((override) => override.id));
    const kept = (this.config.holidayOverrides ?? []).filter((override) => !ids.has(override.id));
    return this.with({ holidayOverrides: [...kept, ...overrides] });
  }

  // ---------------------------------------------------------------------------
  // Data coverage
  // ---------------------------------------------------------------------------

  /** Coverage of every enabled calendar for a year. */
  getCoverage(year?: number): readonly DataCoverage[] {
    const target = year ?? this.requireYear();
    assertYear(target);
    return deepFreeze(this.options.calendars.map((calendar) => this.coverageFor(calendar, target)));
  }

  /** True if every enabled calendar has data for the year. */
  hasDataFor(year: number): boolean {
    return this.options.calendars.every((calendar) => this.datasets.has(datasetKey(calendar, year)));
  }

  private coverageFor(calendar: CalendarId, year: number): DataCoverage {
    const dataset = this.datasets.get(datasetKey(calendar, year));
    if (dataset) {
      return {
        calendar,
        year,
        status: "available",
        datasetVersion: dataset.version,
        ...(dataset.source?.retrievedDate ? { checkedDate: dataset.source.retrievedDate } : {}),
      };
    }
    const known = BUILT_IN_COVERAGE.find((entry) => entry.calendar === calendar && entry.year === year);
    return (
      known ?? {
        calendar,
        year,
        status: "unavailable",
        reason: `No ${calendar} dataset is bundled for ${year}.`,
      }
    );
  }

  private requireYear(): number {
    if (this.options.year === undefined) {
      throw new ConfigurationError("No year given: pass a year argument or set the calendar's `year` option");
    }
    return this.options.year;
  }

  // ---------------------------------------------------------------------------
  // Year index
  // ---------------------------------------------------------------------------

  private index(year: number): YearIndex {
    const cached = this.cache.get(year);
    if (cached) return cached;
    assertYear(year);

    if (this.options.onMissingData === "throw") {
      for (const calendar of this.options.calendars) {
        if (!this.datasets.has(datasetKey(calendar, year))) {
          throw new HolidayDataUnavailableError(calendar, year, this.coverageFor(calendar, year).reason);
        }
      }
    }

    const yearStart = startOfYear(year);
    const yearEnd = endOfYear(year);
    const records: HolidayRecord[] = [];
    for (const calendar of this.options.calendars) {
      for (const datasetYear of [year - 1, year]) {
        const dataset = this.datasets.get(datasetKey(calendar, datasetYear));
        if (dataset) records.push(...dataset.holidays.map((record) => this.applyOverride(record)));
      }
    }
    records.push(...this.customRecords);
    for (const ruleYear of [year - 1, year]) records.push(...this.recurringFor(ruleYear));

    const active: Holiday[] = [];
    const observances: Holiday[] = [];
    for (const record of records) {
      if (record.date > yearEnd || (record.endDate ?? record.date) < yearStart) continue;
      if (!this.isIncluded(record)) continue;
      const holiday = localizeHoliday(record, this.options.locale);
      (record.category === "observance" || record.type === "observance" ? observances : active).push(holiday);
    }

    const byDate = this.buildDayMap(active, yearStart, yearEnd);
    const observancesByDate = this.buildDayMap(observances, yearStart, yearEnd);
    const visible = (holiday: Holiday): boolean => {
      for (let day = toDayNumber(holiday.date); day <= toDayNumber(holiday.endDate ?? holiday.date); day++) {
        if (!this.excludedDateSet.has(fromDayNumber(day))) return true;
      }
      return false;
    };

    const result: YearIndex = {
      year,
      holidays: Object.freeze(active.filter(visible).sort(compareHolidays)),
      observances: Object.freeze(observances.filter(visible).sort(compareHolidays)),
      byDate,
      observancesByDate,
    };
    this.cache.set(year, result);
    return result;
  }

  private buildDayMap(
    holidays: readonly Holiday[],
    yearStart: ISODateString,
    yearEnd: ISODateString,
  ): Map<ISODateString, readonly Holiday[]> {
    const map = new Map<ISODateString, Holiday[]>();
    for (const holiday of holidays) {
      const from = Math.max(toDayNumber(holiday.date), toDayNumber(yearStart));
      const to = Math.min(toDayNumber(holiday.endDate ?? holiday.date), toDayNumber(yearEnd));
      for (let day = from; day <= to; day++) {
        const date = fromDayNumber(day);
        if (this.excludedDateSet.has(date)) continue;
        const list = map.get(date);
        if (list) list.push(holiday);
        else map.set(date, [holiday]);
      }
    }
    for (const [date, list] of map) map.set(date, Object.freeze(list.sort(compareByPrecedence)) as Holiday[]);
    return map;
  }

  private applyOverride(record: HolidayRecord): HolidayRecord {
    const override = this.overrides.get(record.id);
    if (!override) return record;
    const { endDate: originalEnd, ...rest } = record;
    const duration = originalEnd === undefined ? 0 : toDayNumber(originalEnd) - toDayNumber(record.date);
    const endDate = override.endDate ?? (duration > 0 ? addDays(override.date, duration) : undefined);
    return {
      ...rest,
      date: override.date,
      ...(endDate !== undefined && endDate !== override.date ? { endDate } : {}),
      dateStatus: override.dateStatus ?? "confirmed",
      ...(override.source ? { source: override.source } : {}),
      metadata: { ...record.metadata, originalDate: record.date },
    };
  }

  private recurringFor(year: number): HolidayRecord[] {
    const result: HolidayRecord[] = [];
    for (const rule of this.recurring) {
      if (rule.fromYear !== undefined && year < rule.fromYear) continue;
      if (rule.toYear !== undefined && year > rule.toYear) continue;
      if (rule.month === 2 && rule.day === 29 && !isLeapYear(year)) continue;
      if (year < 1 || year > 9999) continue;
      const date = formatISODate(year, rule.month, rule.day);
      const duration = rule.durationDays ?? 1;
      const id = `${rule.id}-${year}`;
      result.push(
        deepFreeze({
          id,
          nameEn: rule.name,
          ...(rule.nameBn !== undefined ? { nameBn: rule.nameBn } : {}),
          date,
          ...(duration > 1 ? { endDate: addDays(date, duration - 1) } : {}),
          category: rule.category ?? "custom",
          type: rule.type ?? "company",
          calendar: "custom",
          dayType: rule.dayType ?? "full",
          dateStatus: "scheduled",
          official: false,
          verification: "unverified",
          ...(rule.description !== undefined ? { descriptionEn: rule.description } : {}),
          ...(rule.descriptionBn !== undefined ? { descriptionBn: rule.descriptionBn } : {}),
          metadata: { ...rule.metadata, recurringId: rule.id },
        } satisfies HolidayRecord),
      );
    }
    return result;
  }

  private isIncluded(record: HolidayRecord): boolean {
    if (this.excludedIdSet.has(record.id)) return false;
    const recurringId = record.metadata?.recurringId;
    if (typeof recurringId === "string" && this.excludedIdSet.has(recurringId)) return false;
    if (record.category === "optional") {
      if (!this.options.includeOptionalHolidays) return false;
      const communities = this.options.optionalHolidayCommunities;
      if (communities && !(record.communities ?? []).some((c) => communities.includes(c))) return false;
    }
    if (
      (record.category === "observance" || record.type === "observance") &&
      !this.options.includeObservances
    ) {
      return false;
    }
    return regionApplies(record.regions, this.options.region);
  }

  private iso(date: DateInput): ISODateString {
    return toISODate(date, this.options.dateInterpretation);
  }

  // ---------------------------------------------------------------------------
  // Holiday queries
  // ---------------------------------------------------------------------------

  private resolveRange(query: HolidayQuery): [ISODateString, ISODateString] {
    if (query.from !== undefined || query.to !== undefined) {
      const from = query.from !== undefined ? this.iso(query.from) : undefined;
      const to = query.to !== undefined ? this.iso(query.to) : undefined;
      const start = from ?? startOfYear(yearOf(to as ISODateString));
      const end = to ?? endOfYear(yearOf(start));
      if (start > end) throw new RangeError(`from (${start}) is after to (${end})`);
      return [start, end];
    }
    const year = query.year ?? this.requireYear();
    assertYear(year);
    if (query.month !== undefined) {
      assertMonth(query.month);
      return [
        formatISODate(year, query.month, 1),
        formatISODate(year, query.month, daysInMonth(year, query.month)),
      ];
    }
    return [startOfYear(year), endOfYear(year)];
  }

  private collect(from: ISODateString, to: ISODateString, includeObservances = false): Holiday[] {
    const seen = new Set<string>();
    const result: Holiday[] = [];
    for (let year = yearOf(from); year <= yearOf(to); year++) {
      const index = this.index(year);
      const lists = includeObservances ? [index.holidays, index.observances] : [index.holidays];
      for (const list of lists) {
        for (const holiday of list) {
          if (seen.has(holiday.id) || !overlapsRange(holiday, from, to)) continue;
          seen.add(holiday.id);
          result.push(holiday);
        }
      }
    }
    return result;
  }

  /**
   * List holidays. With no arguments, lists the calendar's `year`.
   * Observances are included when `includeObservances` is enabled.
   */
  getHolidays(query: HolidayQuery = {}): readonly Holiday[] {
    return this.queryHolidays(query).items;
  }

  /** Like `getHolidays` but returns a page with `total` and `hasMore`. */
  queryHolidays(query: HolidayQuery = {}): HolidayPage<Holiday> {
    const [from, to] = this.resolveRange(query);
    const matches = sortHolidays(
      this.collect(from, to, this.options.includeObservances).filter((h) => matchesAttributes(h, query)),
      query.sort ?? "date",
    );
    const offset = query.offset ?? 0;
    const limit = query.limit ?? matches.length;
    if (!Number.isInteger(offset) || offset < 0)
      throw new RangeError("offset must be a non-negative integer");
    if (!Number.isInteger(limit) || limit < 0) throw new RangeError("limit must be a non-negative integer");
    const items = matches.slice(offset, offset + limit);
    return Object.freeze({
      items: Object.freeze(items),
      total: matches.length,
      offset,
      limit,
      hasMore: offset + items.length < matches.length,
    });
  }

  /** All active holidays on a date (sorted by precedence). */
  getHolidaysOn(date: DateInput): readonly Holiday[] {
    const iso = this.iso(date);
    return this.index(yearOf(iso)).byDate.get(iso) ?? Object.freeze([]);
  }

  /** The highest-precedence holiday on a date, if any. */
  getHoliday(date: DateInput): Holiday | undefined {
    return this.getHolidaysOn(date)[0];
  }

  /** True if any active holiday (full or half day) falls on the date. */
  isHoliday(date: DateInput): boolean {
    return this.getHolidaysOn(date).length > 0;
  }

  /** Find an active holiday by id. Searches the year encoded in the id, the calendar year, and all dataset years. */
  getHolidayById(id: string): Holiday | undefined {
    const years = new Set<number>();
    const prefix = /^(\d{4})-/.exec(id);
    if (prefix) years.add(Number(prefix[1]));
    const suffix = /-(\d{4})$/.exec(id);
    if (suffix) years.add(Number(suffix[1]));
    if (this.options.year !== undefined) years.add(this.options.year);
    for (const dataset of this.datasets.values()) {
      if (dataset.holidays.some((record) => record.id === id)) years.add(dataset.year);
    }
    for (const record of this.customRecords) if (record.id === id) years.add(yearOf(record.date));
    for (const year of [...years].sort((a, b) => a - b)) {
      if (year < 1 || year > 9999) continue;
      if (this.options.onMissingData === "throw" && !this.hasDataFor(year)) continue;
      const found = this.index(year).holidays.find((holiday) => holiday.id === id);
      if (found) return found;
    }
    return undefined;
  }

  getHolidaysByMonth(year: number, month: number): readonly Holiday[] {
    return this.getHolidays({ year, month });
  }

  getHolidaysByCategory(
    year: number,
    category: HolidayCategory | readonly HolidayCategory[],
  ): readonly Holiday[] {
    return this.getHolidays({ year, category });
  }

  getHolidaysByType(year: number, type: HolidayType | readonly HolidayType[]): readonly Holiday[] {
    return this.getHolidays({ year, type });
  }

  getHolidayCount(query: HolidayQuery = {}): number {
    return this.queryHolidays(query).total;
  }

  /** Latest year with any data source (datasets or custom holidays). */
  private dataYearBounds(): [number, number] {
    const years: number[] = [];
    for (const dataset of this.datasets.values()) years.push(dataset.year);
    for (const record of this.customRecords)
      years.push(yearOf(record.date), yearOf(record.endDate ?? record.date));
    if (years.length === 0) return [Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];
    return [Math.min(...years), Math.max(...years)];
  }

  /** The first holiday starting after `date` (or on it, with `inclusive`). */
  getNextHoliday(date: DateInput, options: { inclusive?: boolean } = {}): Holiday | undefined {
    return this.getUpcomingHolidays(date, { limit: 1, inclusive: options.inclusive ?? false })[0];
  }

  /** The last holiday starting before `date` (or on it, with `inclusive`). */
  getPreviousHoliday(date: DateInput, options: { inclusive?: boolean } = {}): Holiday | undefined {
    const iso = this.iso(date);
    const inclusive = options.inclusive ?? false;
    const [minYear] = this.dataYearBounds();
    const stop = Math.min(minYear, yearOf(iso) - 1, ...(this.recurring.length ? [yearOf(iso) - 1] : []));
    for (let year = yearOf(iso); year >= Math.max(stop, 1); year--) {
      const candidates = this.index(year).holidays.filter((h) => (inclusive ? h.date <= iso : h.date < iso));
      const last = candidates[candidates.length - 1];
      if (last) return last;
    }
    return undefined;
  }

  /** Holidays starting on/after `from` (default: today in Bangladesh). */
  getUpcomingHolidays(from?: DateInput, options: UpcomingHolidayOptions = {}): readonly Holiday[] {
    const iso = from === undefined ? todayInBangladesh() : this.iso(from);
    const limit = options.limit ?? 5;
    const inclusive = options.inclusive ?? true;
    if (!Number.isInteger(limit) || limit < 0) throw new RangeError("limit must be a non-negative integer");
    const until = options.withinDays === undefined ? undefined : addDays(iso, options.withinDays);
    const [, maxYear] = this.dataYearBounds();
    // Under the "throw" policy, look one year past the data so that running out of
    // data raises HolidayDataUnavailableError instead of silently returning fewer results.
    const lastYear =
      Math.max(maxYear, this.recurring.length ? yearOf(iso) + 1 : yearOf(iso)) +
      (this.options.onMissingData === "throw" ? 1 : 0);
    const result: Holiday[] = [];
    const seen = new Set<string>();
    for (let year = yearOf(iso); year <= Math.min(lastYear, 9999) && result.length < limit; year++) {
      if (until !== undefined && startOfYear(year) > until) break;
      for (const holiday of this.index(year).holidays) {
        if (result.length >= limit) break;
        if (seen.has(holiday.id)) continue;
        if (inclusive ? holiday.date < iso : holiday.date <= iso) continue;
        if (until !== undefined && holiday.date > until) break;
        seen.add(holiday.id);
        result.push(holiday);
      }
    }
    return Object.freeze(result);
  }

  // ---------------------------------------------------------------------------
  // Day classification
  // ---------------------------------------------------------------------------

  isWeekend(date: DateInput): boolean {
    return this.weekendSet.has(getWeekday(this.iso(date)));
  }

  /** Full classification of a date, including the reason for its status. */
  getDayInfo(date: DateInput): DayInfo {
    const iso = this.iso(date);
    const index = this.index(yearOf(iso));
    const holidays = index.byDate.get(iso) ?? [];
    const observances = index.observancesByDate.get(iso) ?? [];
    const weekday = getWeekday(iso);
    const isWeekend = this.weekendSet.has(weekday);
    const isOverride = this.workingOverrideSet.has(iso);
    const fullDay = holidays.some((holiday) => holiday.dayType === "full");
    const halfDay = !fullDay && holidays.length > 0;
    let isBusinessDay: boolean;
    let reason: DayInfo["reason"];
    if (isOverride) {
      isBusinessDay = true;
      reason = "working-day-override";
    } else if (fullDay) {
      isBusinessDay = false;
      reason = "holiday";
    } else if (isWeekend) {
      isBusinessDay = false;
      reason = "weekend";
    } else if (halfDay) {
      isBusinessDay = this.options.halfDayIsBusinessDay;
      reason = "half-day";
    } else {
      isBusinessDay = true;
      reason = "business-day";
    }
    return Object.freeze({
      date: iso,
      weekday,
      isWeekend,
      holidays: frozenList(holidays),
      observances: frozenList(observances),
      isHoliday: holidays.length > 0,
      isHalfDay: halfDay,
      isWorkingDayOverride: isOverride,
      isBusinessDay,
      reason,
    });
  }

  isBusinessDay(date: DateInput): boolean {
    return this.businessDay(this.iso(date));
  }

  /** Alias of {@link isBusinessDay}, for HR/payroll readability. */
  isWorkingDay(date: DateInput): boolean {
    return this.isBusinessDay(date);
  }

  /** True if the date has only half-day holidays (and no full-day holiday). */
  isHalfDay(date: DateInput): boolean {
    return this.getDayInfo(date).isHalfDay;
  }

  private businessDay(iso: ISODateString): boolean {
    if (this.workingOverrideSet.has(iso)) return true;
    const holidays = this.index(yearOf(iso)).byDate.get(iso);
    if (holidays?.some((holiday) => holiday.dayType === "full")) return false;
    if (this.weekendSet.has(getWeekday(iso))) return false;
    if (holidays && holidays.length > 0) return this.options.halfDayIsBusinessDay;
    return true;
  }

  // ---------------------------------------------------------------------------
  // Business-day arithmetic
  // ---------------------------------------------------------------------------

  /**
   * Move `days` business days from `date`. Negative values move backwards.
   * `0` returns `date` unchanged (even if it is not a business day).
   */
  addBusinessDays(date: DateInput, days: number): ISODateString {
    if (!Number.isInteger(days)) throw new RangeError(`days must be an integer, got ${String(days)}`);
    let current = toDayNumber(this.iso(date));
    const step = days < 0 ? -1 : 1;
    let remaining = Math.abs(days);
    let guard = 0;
    while (remaining > 0) {
      current += step;
      if (this.businessDay(fromDayNumber(current))) remaining--;
      if (++guard > MAX_SEARCH_DAYS + Math.abs(days)) {
        throw new RangeError(
          "No business day found within the search limit; check weekend and closure settings",
        );
      }
    }
    return fromDayNumber(current);
  }

  subtractBusinessDays(date: DateInput, days: number): ISODateString {
    if (!Number.isInteger(days)) throw new RangeError(`days must be an integer, got ${String(days)}`);
    return this.addBusinessDays(date, -days);
  }

  /** The first business day strictly after `date`. */
  getNextBusinessDay(date: DateInput): ISODateString {
    return this.addBusinessDays(date, 1);
  }

  /** The last business day strictly before `date`. */
  getPreviousBusinessDay(date: DateInput): ISODateString {
    return this.addBusinessDays(date, -1);
  }

  /** `date` if it is a business day, otherwise the next (or previous) one. */
  rollToBusinessDay(date: DateInput, direction: "forward" | "backward" = "forward"): ISODateString {
    const iso = this.iso(date);
    if (this.businessDay(iso)) return iso;
    return this.addBusinessDays(iso, direction === "forward" ? 1 : -1);
  }

  /** Business days in `[start, end]`, honouring `includeStart`/`includeEnd`. */
  getBusinessDaysBetween(
    start: DateInput,
    end: DateInput,
    options: DateRangeOptions = {},
  ): readonly ISODateString[] {
    const from = this.iso(start);
    const to = this.iso(end);
    if (from > to) throw new RangeError(`start (${from}) is after end (${to})`);
    const first = toDayNumber(from) + (options.includeStart === false ? 1 : 0);
    const last = toDayNumber(to) - (options.includeEnd === false ? 1 : 0);
    const result: ISODateString[] = [];
    for (let day = first; day <= last; day++) {
      const iso = fromDayNumber(day);
      if (this.businessDay(iso)) result.push(iso);
    }
    return Object.freeze(result);
  }

  /** Number of business days in `[start, end]` (both ends included by default). */
  countBusinessDays(start: DateInput, end: DateInput, options: DateRangeOptions = {}): number {
    return this.getBusinessDaysBetween(start, end, options).length;
  }

  private monthRange(year: number, month?: number): [ISODateString, ISODateString] {
    assertYear(year);
    if (month === undefined) return [startOfYear(year), endOfYear(year)];
    assertMonth(month);
    return [formatISODate(year, month, 1), formatISODate(year, month, daysInMonth(year, month))];
  }

  /** Business days in a month (or the whole year when `month` is omitted). */
  getWorkingDays(year: number, month?: number): readonly ISODateString[] {
    const [from, to] = this.monthRange(year, month);
    return this.getBusinessDaysBetween(from, to);
  }

  /** Weekend dates in a month (or year). Requires no holiday data. */
  getWeekendDays(year: number, month?: number): readonly ISODateString[] {
    const [from, to] = this.monthRange(year, month);
    const result: ISODateString[] = [];
    for (let day = toDayNumber(from); day <= toDayNumber(to); day++) {
      const iso = fromDayNumber(day);
      if (this.weekendSet.has(getWeekday(iso))) result.push(iso);
    }
    return Object.freeze(result);
  }

  /**
   * Runs of at least `minDays` consecutive non-business days that overlap the
   * year and contain at least one holiday. Runs extend into adjacent years when
   * data for them is available; otherwise they are cut and marked `truncated`.
   */
  getLongWeekends(year?: number, options: LongWeekendOptions = {}): readonly LongWeekend[] {
    const target = year ?? this.requireYear();
    assertYear(target);
    const minDays = options.minDays ?? 3;
    if (!Number.isInteger(minDays) || minDays < 1) throw new RangeError("minDays must be a positive integer");
    this.index(target);
    const canRead = (iso: ISODateString): boolean =>
      this.options.onMissingData === "ignore" || this.hasDataFor(yearOf(iso));

    const runs: LongWeekend[] = [];
    const firstDay = toDayNumber(startOfYear(target));
    const lastDay = toDayNumber(endOfYear(target));
    let day = firstDay;
    while (day <= lastDay) {
      if (this.businessDay(fromDayNumber(day))) {
        day++;
        continue;
      }
      let start = day;
      let truncated = false;
      if (day === firstDay) {
        while (true) {
          const previous = fromDayNumber(start - 1);
          if (!canRead(previous)) {
            truncated = true;
            break;
          }
          if (this.businessDay(previous)) break;
          start--;
        }
      }
      let end = day;
      while (true) {
        const next = fromDayNumber(end + 1);
        if (end + 1 > lastDay && !canRead(next)) {
          truncated = true;
          break;
        }
        if (this.businessDay(next)) break;
        end++;
      }
      const holidays = this.collect(fromDayNumber(start), fromDayNumber(end)).filter((holiday) => {
        for (let d = toDayNumber(holiday.date); d <= toDayNumber(holiday.endDate ?? holiday.date); d++) {
          if (d >= start && d <= end && !this.excludedDateSet.has(fromDayNumber(d))) return true;
        }
        return false;
      });
      const length = end - start + 1;
      if (length >= minDays && holidays.length > 0) {
        runs.push(
          Object.freeze({
            startDate: fromDayNumber(start),
            endDate: fromDayNumber(end),
            days: length,
            holidays: Object.freeze(holidays.sort(compareHolidays)),
            truncated,
          }),
        );
      }
      day = end + 1;
    }
    return Object.freeze(runs);
  }

  /**
   * Leave planner: which business days to take off for the longest breaks.
   *
   * Every suggestion takes 1…`maxLeaveDays` consecutive business days off and joins
   * them with the weekends/holidays around them. Results are ranked by efficiency
   * (days off per leave day), then by length; by default only the best plan per
   * break is returned. Breaks reach into adjacent years when data is available;
   * otherwise they are cut at the year boundary and marked `truncated`.
   */
  suggestLeave(year?: number, options: LeaveSuggestionOptions = {}): readonly LeaveSuggestion[] {
    const target = year ?? this.requireYear();
    assertYear(target);
    const maxLeave = options.maxLeaveDays ?? 3;
    const minDaysOff = options.minDaysOff ?? 4;
    const limit = options.limit ?? 10;
    const requireHoliday = options.requireHoliday ?? true;
    if (!Number.isInteger(maxLeave) || maxLeave < 1 || maxLeave > 30) {
      throw new RangeError("maxLeaveDays must be an integer between 1 and 30");
    }
    if (!Number.isInteger(minDaysOff) || minDaysOff < 1)
      throw new RangeError("minDaysOff must be a positive integer");
    if (!Number.isInteger(limit) || limit < 0) throw new RangeError("limit must be a non-negative integer");
    this.index(target);
    const canRead = (iso: ISODateString): boolean =>
      this.options.onMissingData === "ignore" || this.hasDataFor(yearOf(iso));

    const firstDay = toDayNumber(startOfYear(target));
    const lastDay = toDayNumber(endOfYear(target));
    /** Nearest business day outside the year, or the first unreadable day (truncated). */
    const boundary = (from: number, step: 1 | -1): { day: number; truncated: boolean } => {
      for (let day = from, guard = 0; guard < 400; day += step, guard++) {
        const iso = fromDayNumber(day);
        if (!canRead(iso)) return { day, truncated: true };
        if (this.businessDay(iso)) return { day, truncated: false };
      }
      return { day: from + step * 400, truncated: true };
    };
    const before = boundary(firstDay - 1, -1);
    const after = boundary(lastDay + 1, 1);
    const business: number[] = [];
    for (let day = firstDay; day <= lastDay; day++)
      if (this.businessDay(fromDayNumber(day))) business.push(day);
    // Sentinels: seq[0] and seq[n + 1] are the business days just outside the year.
    const seq = [before.day, ...business, after.day];

    const candidates: LeaveSuggestion[] = [];
    for (let k = 1; k <= business.length; k++) {
      for (let count = 1; count <= maxLeave && k + count - 1 <= business.length; count++) {
        const start = (seq[k - 1] ?? 0) + 1;
        const end = (seq[k + count] ?? 0) - 1;
        const daysOff = end - start + 1;
        if (daysOff < minDaysOff || daysOff <= count) continue;
        const holidays = new Map<string, Holiday>();
        for (let day = start; day <= end; day++) {
          const iso = fromDayNumber(day);
          for (const holiday of this.index(yearOf(iso)).byDate.get(iso) ?? [])
            holidays.set(holiday.id, holiday);
        }
        if (requireHoliday && holidays.size === 0) continue;
        const leaveDates = seq.slice(k, k + count).map(fromDayNumber);
        candidates.push({
          startDate: fromDayNumber(start),
          endDate: fromDayNumber(end),
          daysOff,
          leaveDates,
          leaveDays: count,
          efficiency: daysOff / count,
          holidays: [...holidays.values()].sort(compareHolidays),
          truncated: (k === 1 && before.truncated) || (k + count === seq.length - 1 && after.truncated),
        });
      }
    }
    candidates.sort(
      (a, b) =>
        b.efficiency - a.efficiency ||
        b.daysOff - a.daysOff ||
        a.leaveDays - b.leaveDays ||
        compareISODates(a.startDate, b.startDate),
    );
    const chosen: LeaveSuggestion[] = [];
    for (const candidate of candidates) {
      if (chosen.length >= limit) break;
      const overlaps = chosen.some(
        (other) => candidate.startDate <= other.endDate && candidate.endDate >= other.startDate,
      );
      if (!options.allowOverlap && overlaps) continue;
      chosen.push(candidate);
    }
    return deepFreeze(chosen);
  }

  /**
   * Month grid for calendar UIs: rows of 7 days (with leading/trailing days of
   * adjacent months), each classified as weekend / holiday / business day.
   */
  getMonthCalendar(year: number, month: number, options: MonthCalendarOptions = {}): MonthCalendar {
    assertYear(year);
    assertMonth(month);
    const weekStartsOn = options.weekStartsOn ?? 0;
    if (!Number.isInteger(weekStartsOn) || weekStartsOn < 0 || weekStartsOn > 6) {
      throw new RangeError("weekStartsOn must be an integer 0 (Sunday) to 6 (Saturday)");
    }
    const withBengali = options.bengaliDates ?? true;
    const locale = this.options.locale;
    const bangla = isBanglaLocale(locale);
    const firstIso = formatISODate(year, month, 1);
    const first = toDayNumber(firstIso);
    const length = daysInMonth(year, month);
    const lead = (getWeekday(firstIso) - weekStartsOn + 7) % 7;
    const cells = options.fixedWeeks ? 42 : Math.ceil((lead + length) / 7) * 7;
    const days: MonthCalendarDay[] = [];
    let businessDays = 0;
    for (let index = 0; index < cells; index++) {
      const dayNumber = first - lead + index;
      const iso = fromDayNumber(dayNumber);
      const inMonth = dayNumber >= first && dayNumber < first + length;
      const weekday = getWeekday(iso);
      const bengaliDate =
        withBengali && iso >= BENGALI_CALENDAR_MIN_DATE
          ? formatBengaliDate(iso, { locale: bangla ? "bn" : "en" })
          : undefined;
      const base = {
        date: iso,
        day: Number(iso.slice(8, 10)),
        weekday,
        inMonth,
        isWeekend: this.weekendSet.has(weekday),
        ...(bengaliDate !== undefined ? { bengaliDate } : {}),
      };
      if (inMonth) {
        const info = this.getDayInfo(iso);
        if (info.isBusinessDay) businessDays++;
        days.push({
          ...base,
          holidays: info.holidays,
          isHoliday: info.isHoliday,
          isHalfDay: info.isHalfDay,
          isBusinessDay: info.isBusinessDay,
        });
      } else {
        days.push({ ...base, holidays: [], isHoliday: false, isHalfDay: false, isBusinessDay: null });
      }
    }
    const weeks: MonthCalendarDay[][] = [];
    for (let index = 0; index < days.length; index += 7) weeks.push(days.slice(index, index + 7));
    const weekdays = Array.from({ length: 7 }, (_, offset) => {
      const weekday = ((weekStartsOn + offset) % 7) as Weekday;
      return { weekday, name: getWeekdayName(weekday, locale), isWeekend: this.weekendSet.has(weekday) };
    });
    return deepFreeze({
      year,
      month,
      monthName: getMonthName(month, locale),
      locale,
      weekdays,
      weeks,
      businessDays,
      holidays: this.getHolidays({ year, month }),
    });
  }

  // ---------------------------------------------------------------------------
  // Statistics and summaries
  // ---------------------------------------------------------------------------

  getHolidayStatistics(year?: number): HolidayStatistics {
    const target = year ?? this.requireYear();
    assertYear(target);
    const index = this.index(target);
    const yearStart = toDayNumber(startOfYear(target));
    const yearEnd = toDayNumber(endOfYear(target));
    const byCategory: Partial<Record<HolidayCategory, CategoryStatistics>> = {};
    const byType: Partial<Record<HolidayType, number>> = {};
    let totalDays = 0;
    let weekendHolidayDays = 0;
    for (const holiday of index.holidays) {
      let days = 0;
      let weekendDays = 0;
      const from = Math.max(toDayNumber(holiday.date), yearStart);
      const to = Math.min(toDayNumber(holiday.endDate ?? holiday.date), yearEnd);
      for (let day = from; day <= to; day++) {
        const iso = fromDayNumber(day);
        if (this.excludedDateSet.has(iso)) continue;
        days++;
        if (this.weekendSet.has(getWeekday(iso))) weekendDays++;
      }
      totalDays += days;
      weekendHolidayDays += weekendDays;
      const current = byCategory[holiday.category] ?? { holidays: 0, days: 0, weekendDays: 0 };
      byCategory[holiday.category] = {
        holidays: current.holidays + 1,
        days: current.days + days,
        weekendDays: current.weekendDays + weekendDays,
      };
      byType[holiday.type] = (byType[holiday.type] ?? 0) + 1;
    }
    const byMonth = new Array<number>(12).fill(0);
    let nonWeekendDates = 0;
    for (const date of index.byDate.keys()) {
      byMonth[monthOf(date) - 1] = (byMonth[monthOf(date) - 1] ?? 0) + 1;
      if (!this.weekendSet.has(getWeekday(date))) nonWeekendDates++;
    }
    const weekendDays = this.getWeekendDays(target).length;
    return deepFreeze({
      year: target,
      totalHolidays: index.holidays.length,
      totalHolidayDays: totalDays,
      holidayDaysOnWeekends: weekendHolidayDays,
      uniqueHolidayDates: index.byDate.size,
      uniqueNonWeekendHolidayDates: nonWeekendDates,
      tentativeHolidays: index.holidays.filter((holiday) => holiday.dateStatus === "tentative").length,
      byCategory,
      byType,
      byMonth,
      calendarDays: daysInYear(target),
      weekendDays,
      businessDays: this.getWorkingDays(target).length,
    });
  }

  getCalendarSummary(year?: number): CalendarSummary {
    const target = year ?? this.requireYear();
    const statistics = this.getHolidayStatistics(target);
    const months: MonthSummary[] = [];
    for (let month = 1; month <= 12; month++) {
      const [from, to] = this.monthRange(target, month);
      let holidayDates = 0;
      for (let day = toDayNumber(from); day <= toDayNumber(to); day++) {
        if (this.index(target).byDate.has(fromDayNumber(day))) holidayDates++;
      }
      months.push({
        month,
        holidays: this.getHolidays({ year: target, month }),
        businessDays: this.getWorkingDays(target, month).length,
        weekendDays: this.getWeekendDays(target, month).length,
        holidayDates,
      });
    }
    return deepFreeze({
      year: target,
      locale: this.options.locale,
      weekend: this.options.weekend,
      calendars: this.options.calendars,
      coverage: this.getCoverage(target),
      statistics,
      months,
    });
  }

  // ---------------------------------------------------------------------------
  // Export
  // ---------------------------------------------------------------------------

  export(format: "json", options?: JsonExportOptions): string;
  export(format: "csv", options?: CsvExportOptions): string;
  export(format: "ics", options?: IcsExportOptions): string;
  /** Export the calendar's holidays for a year (default: the calendar year) or a date range. */
  export(
    format: ExportFormat,
    options: JsonExportOptions | CsvExportOptions | IcsExportOptions = {},
  ): string {
    const query: HolidayQuery =
      options.from !== undefined || options.to !== undefined
        ? {
            ...(options.from !== undefined ? { from: options.from } : {}),
            ...(options.to !== undefined ? { to: options.to } : {}),
          }
        : { year: options.year ?? this.requireYear() };
    const [from, to] = this.resolveRange(query);
    const locale = options.locale ?? this.options.locale;
    const holidays = this.getHolidays(query).map((holiday) =>
      holiday.locale === locale ? holiday : localizeHoliday(holiday, locale),
    );
    switch (format) {
      case "json": {
        const indent = (options as JsonExportOptions).indent;
        const years: number[] = [];
        for (let y = yearOf(from); y <= yearOf(to); y++) years.push(y);
        return exportToJson(holidays, {
          ...(indent !== undefined ? { indent } : {}),
          meta: {
            locale,
            from,
            to,
            weekend: this.options.weekend,
            calendars: this.options.calendars,
            coverage: years.flatMap((y) => this.getCoverage(y)),
          },
        });
      }
      case "csv":
        return exportToCsv(holidays, { ...(options as CsvExportOptions), locale });
      case "ics":
        return exportToIcs(holidays, { ...(options as IcsExportOptions), locale });
      default:
        throw new TypeError(`Unsupported export format: ${String(format)}. Use "json", "csv" or "ics".`);
    }
  }
}

/** Categories that make a day non-working (all except observances). */
export const DAY_OFF_CATEGORIES: readonly HolidayCategory[] = Object.freeze(
  HOLIDAY_CATEGORIES.filter((category) => category !== "observance").sort(
    (a, b) => CATEGORY_PRIORITY[a] - CATEGORY_PRIORITY[b],
  ),
);
