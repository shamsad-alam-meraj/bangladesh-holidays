/**
 * Timezone-safe calendar-date utilities.
 *
 * All arithmetic is performed on integer "day numbers" (days since 1970-01-01)
 * computed with `Date.UTC`, so results never depend on the host time zone or DST.
 */
import { InvalidDateError } from "./errors";
import type { DateInput, DateInterpretation, Weekday } from "../types/options";
import type { ISODateString } from "../types/holiday";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;
/** Bangladesh Standard Time offset (UTC+06:00). Bangladesh does not observe DST. */
const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;

export interface DateParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
}

export function daysInYear(year: number): number {
  return isLeapYear(year) ? 366 : 365;
}

/** Strictly parse an ISO `YYYY-MM-DD` string. Throws `InvalidDateError`. */
export function parseISODate(value: string): DateParts {
  const match = typeof value === "string" ? ISO_DATE.exec(value) : null;
  if (!match) throw new InvalidDateError(value);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1) throw new InvalidDateError(value, "year must be 0001 or later");
  if (month < 1 || month > 12) throw new InvalidDateError(value, "month out of range");
  if (day < 1 || day > daysInMonth(year, month)) {
    throw new InvalidDateError(value, "day out of range for month");
  }
  return { year, month, day };
}

/** True if `value` is a strictly valid ISO date string. */
export function isValidISODate(value: unknown): value is ISODateString {
  if (typeof value !== "string") return false;
  try {
    parseISODate(value);
    return true;
  } catch {
    return false;
  }
}

export function formatISODate(year: number, month: number, day: number): ISODateString {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Convert a `Date` to a calendar date without mutating it.
 * @param mode see {@link DateInterpretation}
 */
export function dateToISODate(date: Date, mode: DateInterpretation = "dhaka"): ISODateString {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) throw new InvalidDateError(date);
  if (mode === "local") {
    return formatISODate(date.getFullYear(), date.getMonth() + 1, date.getDate());
  }
  const shifted = mode === "dhaka" ? new Date(date.getTime() + DHAKA_OFFSET_MS) : date;
  return formatISODate(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate());
}

/** Normalize a `DateInput` to a validated ISO date string. */
export function toISODate(input: DateInput, mode: DateInterpretation = "dhaka"): ISODateString {
  if (typeof input === "string") {
    parseISODate(input);
    return input;
  }
  if (input instanceof Date) return dateToISODate(input, mode);
  throw new InvalidDateError(input);
}

/** Today's date in Bangladesh (UTC+06:00). */
export function todayInBangladesh(now: Date = new Date()): ISODateString {
  return dateToISODate(now, "dhaka");
}

function partsToDayNumber(parts: DateParts): number {
  const ms = Date.UTC(parts.year, parts.month - 1, parts.day);
  // Date.UTC maps years 0–99 to 1900–1999; correct for that.
  if (parts.year < 100) {
    const date = new Date(ms);
    date.setUTCFullYear(parts.year);
    return Math.round(date.getTime() / MS_PER_DAY);
  }
  return Math.round(ms / MS_PER_DAY);
}

/** Days since 1970-01-01 for an ISO date. */
export function toDayNumber(iso: ISODateString): number {
  return partsToDayNumber(parseISODate(iso));
}

/** ISO date for a day number. */
export function fromDayNumber(dayNumber: number): ISODateString {
  const date = new Date(dayNumber * MS_PER_DAY);
  return formatISODate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

/** Add (or subtract) calendar days. */
export function addDays(iso: ISODateString, days: number): ISODateString {
  if (!Number.isInteger(days)) throw new RangeError(`days must be an integer, got ${String(days)}`);
  return fromDayNumber(toDayNumber(iso) + days);
}

/** Day of week (0 = Sunday). */
export function getWeekday(iso: ISODateString): Weekday {
  return ((((toDayNumber(iso) + 4) % 7) + 7) % 7) as Weekday;
}

/** Number of days from `a` to `b` (positive when `b` is later). */
export function diffDays(a: ISODateString, b: ISODateString): number {
  return toDayNumber(b) - toDayNumber(a);
}

/** Compare two ISO date strings (valid ISO dates sort lexicographically). */
export function compareISODates(a: ISODateString, b: ISODateString): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function yearOf(iso: ISODateString): number {
  return Number(iso.slice(0, 4));
}

export function monthOf(iso: ISODateString): number {
  return Number(iso.slice(5, 7));
}

/** Every date from `start` to `end` inclusive. */
export function eachDay(start: ISODateString, end: ISODateString): ISODateString[] {
  const from = toDayNumber(start);
  const to = toDayNumber(end);
  const result: ISODateString[] = [];
  for (let day = from; day <= to; day++) result.push(fromDayNumber(day));
  return result;
}

export function assertYear(year: unknown, label = "year"): asserts year is number {
  if (typeof year !== "number" || !Number.isInteger(year) || year < 1 || year > 9999) {
    throw new RangeError(`${label} must be an integer between 1 and 9999, got ${String(year)}`);
  }
}

export function assertMonth(month: unknown): asserts month is number {
  if (typeof month !== "number" || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new RangeError(`month must be an integer between 1 and 12, got ${String(month)}`);
  }
}

export function startOfYear(year: number): ISODateString {
  return formatISODate(year, 1, 1);
}

export function endOfYear(year: number): ISODateString {
  return formatISODate(year, 12, 31);
}
