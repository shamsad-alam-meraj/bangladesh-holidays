import { addDays, endOfYear, startOfYear, toISODate, toDayNumber, fromDayNumber } from "./date-utils";
import { normalizeDataset } from "./validation";
import { deepFreeze } from "../utils/freeze";
import { compareByPrecedence } from "../utils/sorting";
import type { HolidayCalendar } from "./calendar";
import type { CalendarDifference, FieldChange, HolidayChangeSet, HolidayConflict } from "../types/calendar";
import type { HolidayDataset, HolidayDatasetInput } from "../types/dataset";
import type { Holiday, HolidayRecord } from "../types/holiday";
import type { DateInput } from "../types/options";

/** Range for comparisons: a whole year or an inclusive date range. */
export type ComparisonRange =
  { readonly year: number } | { readonly from: DateInput; readonly to: DateInput };

function rangeOf(range: ComparisonRange): [string, string] {
  if ("year" in range) return [startOfYear(range.year), endOfYear(range.year)];
  const from = toISODate(range.from);
  const to = toISODate(range.to);
  if (from > to) throw new RangeError(`from (${from}) is after to (${to})`);
  return [from, to];
}

/**
 * Compare two calendars day by day and return the dates on which their
 * business-day status or active holidays differ.
 */
export function compareHolidayCalendars(
  a: HolidayCalendar,
  b: HolidayCalendar,
  range: ComparisonRange,
): readonly CalendarDifference[] {
  const [from, to] = rangeOf(range);
  const differences: CalendarDifference[] = [];
  for (let day = toDayNumber(from); day <= toDayNumber(to); day++) {
    const date = fromDayNumber(day);
    const infoA = a.getDayInfo(date);
    const infoB = b.getDayInfo(date);
    const idsA = infoA.holidays.map((holiday) => holiday.id);
    const idsB = infoB.holidays.map((holiday) => holiday.id);
    if (infoA.isBusinessDay !== infoB.isBusinessDay || idsA.join("|") !== idsB.join("|")) {
      differences.push({
        date,
        a: { isBusinessDay: infoA.isBusinessDay, holidayIds: idsA },
        b: { isBusinessDay: infoB.isBusinessDay, holidayIds: idsB },
      });
    }
  }
  return deepFreeze(differences);
}

/**
 * Find dates on which more than one holiday is active.
 * Accepts a list of holidays (e.g. from `getHolidays`) or a calendar plus range.
 */
export function findConflictingHolidays(holidays: readonly Holiday[]): readonly HolidayConflict[];
export function findConflictingHolidays(
  calendar: HolidayCalendar,
  range: ComparisonRange,
): readonly HolidayConflict[];
export function findConflictingHolidays(
  source: readonly Holiday[] | HolidayCalendar,
  range?: ComparisonRange,
): readonly HolidayConflict[] {
  let holidays: readonly Holiday[];
  if (Array.isArray(source)) {
    holidays = source as readonly Holiday[];
  } else {
    if (!range) throw new TypeError("findConflictingHolidays(calendar, range) requires a range");
    const [from, to] = rangeOf(range);
    holidays = (source as HolidayCalendar).getHolidays({ from, to });
  }
  const byDate = new Map<string, Holiday[]>();
  for (const holiday of holidays) {
    let date = holiday.date;
    const end = holiday.endDate ?? holiday.date;
    while (date <= end) {
      const list = byDate.get(date) ?? [];
      list.push(holiday);
      byDate.set(date, list);
      date = addDays(date, 1);
    }
  }
  const conflicts: HolidayConflict[] = [];
  for (const [date, list] of [...byDate.entries()].sort(([x], [y]) => (x < y ? -1 : 1))) {
    if (list.length > 1) conflicts.push({ date, holidays: list.sort(compareByPrecedence) });
  }
  return Object.freeze(
    conflicts.map((conflict) => Object.freeze({ ...conflict, holidays: Object.freeze(conflict.holidays) })),
  );
}

const COMPARED_FIELDS = [
  "date",
  "endDate",
  "nameEn",
  "nameBn",
  "category",
  "type",
  "calendar",
  "dayType",
  "dateStatus",
  "official",
  "verification",
  "descriptionEn",
  "descriptionBn",
  "regions",
  "communities",
  "substituteFor",
] as const;

type Comparable = HolidayRecord | Holiday;

function toRecords(
  source: HolidayDataset | HolidayDatasetInput | readonly Comparable[],
): readonly Comparable[] {
  if (Array.isArray(source)) return source as readonly Comparable[];
  const dataset = source as HolidayDataset | HolidayDatasetInput;
  return Object.isFrozen(dataset) ? (dataset as HolidayDataset).holidays : normalizeDataset(dataset).holidays;
}

/**
 * Diff two versions of a dataset (or two holiday lists), matching records by id.
 * Use it to review data updates, e.g. after a revised government notice.
 */
export function getHolidayChanges<T extends Comparable = HolidayRecord>(
  before: HolidayDataset | HolidayDatasetInput | readonly T[],
  after: HolidayDataset | HolidayDatasetInput | readonly T[],
): HolidayChangeSet<T> {
  const oldRecords = toRecords(before) as readonly T[];
  const newRecords = toRecords(after) as readonly T[];
  const oldById = new Map(oldRecords.map((record) => [record.id, record]));
  const newById = new Map(newRecords.map((record) => [record.id, record]));
  const added = newRecords.filter((record) => !oldById.has(record.id));
  const removed = oldRecords.filter((record) => !newById.has(record.id));
  const changed: { id: string; before: T; after: T; changes: FieldChange[] }[] = [];
  let unchanged = 0;
  for (const record of newRecords) {
    const previous = oldById.get(record.id);
    if (!previous) continue;
    const changes: FieldChange[] = [];
    for (const field of COMPARED_FIELDS) {
      const x = (previous as unknown as Record<string, unknown>)[field];
      const y = (record as unknown as Record<string, unknown>)[field];
      if (JSON.stringify(x) !== JSON.stringify(y)) changes.push({ field, before: x, after: y });
    }
    if (changes.length > 0) changed.push({ id: record.id, before: previous, after: record, changes });
    else unchanged++;
  }
  return Object.freeze({
    added: Object.freeze(added),
    removed: Object.freeze(removed),
    changed: Object.freeze(
      changed.map((change) => Object.freeze({ ...change, changes: Object.freeze(change.changes) })),
    ),
    unchanged,
  });
}
