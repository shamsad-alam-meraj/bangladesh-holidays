import { getWeekday, parseISODate, toISODate } from "../core/date-utils";
import type { Community, DateStatus, HolidayCategory, HolidayType, LocaleCode } from "../types/holiday";
import type { DateInput, DateInterpretation } from "../types/options";
import { bn } from "./bn";
import { en } from "./en";
import { toBanglaDigits } from "./numerals";

export const SUPPORTED_LOCALES: readonly LocaleCode[] = Object.freeze(["en", "en-BD", "bn", "bn-BD"]);

export function isSupportedLocale(value: unknown): value is LocaleCode {
  return typeof value === "string" && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/** True for `bn` and `bn-BD`. */
export function isBanglaLocale(locale: LocaleCode): boolean {
  return locale === "bn" || locale === "bn-BD";
}

function strings(locale: LocaleCode) {
  return isBanglaLocale(locale) ? bn : en;
}

export interface FormatDateOptions {
  /** Prefix the weekday name. Default `false`. */
  readonly weekday?: boolean;
  /** Zero-pad the day. Default `true` for Bangla (official style), `false` for English. */
  readonly padDay?: boolean;
  /** Digits for Bangla locales: `"bn"` (default) or `"latn"`. */
  readonly numerals?: "bn" | "latn";
  readonly dateInterpretation?: DateInterpretation;
}

/**
 * Format a date for display.
 *
 * `formatDate("2027-03-26", "bn-BD", { weekday: true })` → `"শুক্রবার, ২৬ মার্চ ২০২৭"`
 * `formatDate("2027-03-26", "en")` → `"26 March 2027"`
 */
export function formatDate(
  input: DateInput,
  locale: LocaleCode = "en",
  options: FormatDateOptions = {},
): string {
  const iso = toISODate(input, options.dateInterpretation);
  const { year, month, day } = parseISODate(iso);
  const text = strings(locale);
  const bangla = isBanglaLocale(locale);
  const pad = options.padDay ?? bangla;
  const dayText = pad ? String(day).padStart(2, "0") : String(day);
  const body = `${dayText} ${text.months[month - 1] ?? ""} ${year}`;
  const withWeekday = options.weekday ? `${text.weekdays[getWeekday(iso)] ?? ""}, ${body}` : body;
  return bangla && options.numerals !== "latn" ? toBanglaDigits(withWeekday) : withWeekday;
}

/** Format a number with locale digits. */
export function formatNumber(value: number, locale: LocaleCode = "en"): string {
  return isBanglaLocale(locale) ? toBanglaDigits(value) : String(value);
}

export function getMonthName(month: number, locale: LocaleCode = "en"): string {
  const name = strings(locale).months[month - 1];
  if (name === undefined) throw new RangeError(`month must be 1–12, got ${String(month)}`);
  return name;
}

export function getWeekdayName(weekday: number, locale: LocaleCode = "en"): string {
  const name = strings(locale).weekdays[weekday];
  if (name === undefined) throw new RangeError(`weekday must be 0–6, got ${String(weekday)}`);
  return name;
}

export function getCategoryLabel(category: HolidayCategory, locale: LocaleCode = "en"): string {
  return strings(locale).categories[category];
}

export function getTypeLabel(type: HolidayType, locale: LocaleCode = "en"): string {
  return strings(locale).types[type];
}

export function getDateStatusLabel(status: DateStatus, locale: LocaleCode = "en"): string {
  return strings(locale).dateStatuses[status];
}

export function getCommunityLabel(community: Community, locale: LocaleCode = "en"): string {
  return strings(locale).communities[community];
}

export { toBanglaDigits, toLatinDigits } from "./numerals";
