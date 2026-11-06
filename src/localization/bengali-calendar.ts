/**
 * Converter for the revised Bangla calendar (বঙ্গাব্দ) used officially in Bangladesh.
 *
 * Rules of the revision adopted from 1426 BS (14 April 2019):
 * - 1 Boishakh is always 14 April.
 * - Boishakh … Ashwin (months 1–6) have 31 days.
 * - Kartik … Magh (months 7–10) and Chaitra (month 12) have 30 days.
 * - Falgun (month 11) has 29 days, or 30 when that Falgun contains 29 February.
 *
 * Dates before 14 April 2019 used earlier rules and are rejected with a RangeError
 * rather than converted inaccurately. This is not the traditional (West Bengal /
 * panjika) Bangla calendar, whose month lengths follow astronomical observation.
 */
import {
  addDays,
  diffDays,
  formatISODate,
  getWeekday,
  isLeapYear,
  parseISODate,
  toISODate,
} from "../core/date-utils";
import type { DateInput, DateInterpretation } from "../types/options";
import type { ISODateString } from "../types/holiday";
import { bn } from "./bn";
import { en } from "./en";
import { toBanglaDigits } from "./numerals";

export const BENGALI_MONTHS_BN = [
  "বৈশাখ",
  "জ্যৈষ্ঠ",
  "আষাঢ়",
  "শ্রাবণ",
  "ভাদ্র",
  "আশ্বিন",
  "কার্তিক",
  "অগ্রহায়ণ",
  "পৌষ",
  "মাঘ",
  "ফাল্গুন",
  "চৈত্র",
] as const;

export const BENGALI_MONTHS_EN = [
  "Boishakh",
  "Joishtho",
  "Asharh",
  "Srabon",
  "Bhadro",
  "Ashwin",
  "Kartik",
  "Ogrohayon",
  "Poush",
  "Magh",
  "Falgun",
  "Choitro",
] as const;

/** Gregorian year minus Bangla year for dates on/after 14 April. */
const YEAR_OFFSET = 593;
/** First supported Bangla year (revised calendar). */
export const BENGALI_CALENDAR_MIN_YEAR = 1426;
/** First supported Gregorian date: 1 Boishakh 1426. */
export const BENGALI_CALENDAR_MIN_DATE: ISODateString = "2019-04-14";

export interface BengaliDate {
  /** Bangla year (বঙ্গাব্দ), e.g. 1433. */
  readonly year: number;
  /** 1 = Boishakh … 12 = Chaitra. */
  readonly month: number;
  readonly day: number;
  readonly monthNameBn: string;
  readonly monthNameEn: string;
  /** e.g. `"১২ চৈত্র ১৪৩৩"`. */
  readonly formattedBn: string;
  /** e.g. `"12 Choitro 1433"`. */
  readonly formattedEn: string;
  /** Season (ঋতু), 1 = Grishma … 6 = Boshonto. Each season spans two months. */
  readonly season: number;
  /** e.g. `"বসন্ত"`. */
  readonly seasonBn: string;
  /** e.g. `"Boshonto"`. */
  readonly seasonEn: string;
  /** Day of week of the Gregorian date (0 = Sunday). */
  readonly weekday: number;
  /** e.g. `"শুক্রবার"`. */
  readonly weekdayBn: string;
  /** e.g. `"Friday"`. */
  readonly weekdayEn: string;
}

/** The six seasons (ঋতু): Boishakh–Joishtho = Grishma, …, Falgun–Choitro = Boshonto. */
export const BENGALI_SEASONS_BN = ["গ্রীষ্ম", "বর্ষা", "শরৎ", "হেমন্ত", "শীত", "বসন্ত"] as const;
export const BENGALI_SEASONS_EN = ["Grishma", "Borsha", "Shorot", "Hemonto", "Sheet", "Boshonto"] as const;

/** Month lengths for a given Bangla year. */
export function getBengaliMonthLengths(bengaliYear: number): readonly number[] {
  assertSupportedBengaliYear(bengaliYear);
  // Falgun of Bangla year B spans February of Gregorian year B + 594.
  const falgun = isLeapYear(bengaliYear + YEAR_OFFSET + 1) ? 30 : 29;
  return [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, falgun, 30];
}

/** Convert a Gregorian date to the revised Bangla calendar. */
export function toBengaliDate(
  input: DateInput,
  dateInterpretation: DateInterpretation = "dhaka",
): BengaliDate {
  const iso = toISODate(input, dateInterpretation);
  if (iso < BENGALI_CALENDAR_MIN_DATE) {
    throw new RangeError(
      `toBengaliDate supports dates from ${BENGALI_CALENDAR_MIN_DATE} (1 Boishakh ${BENGALI_CALENDAR_MIN_YEAR}) onward; got ${iso}.`,
    );
  }
  const { year: gregorianYear } = parseISODate(iso);
  const newYearThisYear = formatISODate(gregorianYear, 4, 14);
  const bengaliYear = iso >= newYearThisYear ? gregorianYear - YEAR_OFFSET : gregorianYear - YEAR_OFFSET - 1;
  let remaining = diffDays(formatISODate(bengaliYear + YEAR_OFFSET, 4, 14), iso);
  const lengths = getBengaliMonthLengths(bengaliYear);
  let month = 0;
  while (remaining >= (lengths[month] ?? 0)) {
    remaining -= lengths[month] ?? 0;
    month++;
  }
  return buildBengaliDate(iso, bengaliYear, month + 1, remaining + 1);
}

/** Convert a revised-Bangla-calendar date to an ISO Gregorian date. */
export function fromBengaliDate(year: number, month: number, day: number): ISODateString {
  assertSupportedBengaliYear(year);
  const lengths = getBengaliMonthLengths(year);
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new RangeError(`Bangla month must be 1–12, got ${String(month)}`);
  }
  const monthLength = lengths[month - 1] ?? 0;
  if (!Number.isInteger(day) || day < 1 || day > monthLength) {
    throw new RangeError(
      `Day ${String(day)} is out of range for ${BENGALI_MONTHS_EN[month - 1] ?? ""} ${year} (1–${monthLength})`,
    );
  }
  let offset = day - 1;
  for (let index = 0; index < month - 1; index++) offset += lengths[index] ?? 0;
  return addDays(formatISODate(year + YEAR_OFFSET, 4, 14), offset);
}

/** Format a Gregorian date as a Bangla calendar date, e.g. `"১২ চৈত্র ১৪৩৩"`. */
export interface FormatBengaliDateOptions {
  readonly locale?: "bn" | "en";
  /** Zero-pad the day. Default `true`. */
  readonly padDay?: boolean;
  /** Prefix the weekday, e.g. "শুক্রবার, ". Default `false`. */
  readonly weekday?: boolean;
  /** Append the season, e.g. " (বসন্তকাল)". Default `false`. */
  readonly season?: boolean;
}

/**
 * Format a Gregorian date as a Bangla calendar date.
 *
 * `formatBengaliDate("2027-03-26")` → `"১২ চৈত্র ১৪৩৩"`
 * `formatBengaliDate("2027-03-26", { weekday: true, season: true })` → `"শুক্রবার, ১২ চৈত্র ১৪৩৩ (বসন্তকাল)"`
 */
export function formatBengaliDate(input: DateInput, options: FormatBengaliDateOptions = {}): string {
  const date = toBengaliDate(input);
  const pad = options.padDay ?? true;
  const day = pad ? String(date.day).padStart(2, "0") : String(date.day);
  const english = options.locale === "en";
  let text = english
    ? `${day} ${date.monthNameEn} ${date.year}`
    : `${toBanglaDigits(day)} ${date.monthNameBn} ${toBanglaDigits(date.year)}`;
  if (options.weekday) text = `${english ? date.weekdayEn : date.weekdayBn}, ${text}`;
  if (options.season) text = `${text} (${english ? date.seasonEn : `${date.seasonBn}কাল`})`;
  return text;
}

function buildBengaliDate(iso: ISODateString, year: number, month: number, day: number): BengaliDate {
  const monthNameBn = BENGALI_MONTHS_BN[month - 1] ?? "";
  const monthNameEn = BENGALI_MONTHS_EN[month - 1] ?? "";
  const paddedDay = String(day).padStart(2, "0");
  const seasonIndex = Math.floor((month - 1) / 2);
  const weekday = getWeekday(iso);
  return Object.freeze({
    year,
    month,
    day,
    monthNameBn,
    monthNameEn,
    formattedBn: `${toBanglaDigits(paddedDay)} ${monthNameBn} ${toBanglaDigits(year)}`,
    formattedEn: `${day} ${monthNameEn} ${year}`,
    season: seasonIndex + 1,
    seasonBn: BENGALI_SEASONS_BN[seasonIndex] ?? "",
    seasonEn: BENGALI_SEASONS_EN[seasonIndex] ?? "",
    weekday,
    weekdayBn: bn.weekdays[weekday] ?? "",
    weekdayEn: en.weekdays[weekday] ?? "",
  });
}

function assertSupportedBengaliYear(year: number): void {
  if (!Number.isInteger(year) || year < BENGALI_CALENDAR_MIN_YEAR || year > 9999 - YEAR_OFFSET - 1) {
    throw new RangeError(
      `Bangla year must be an integer from ${BENGALI_CALENDAR_MIN_YEAR} (revised calendar); got ${String(year)}`,
    );
  }
}
