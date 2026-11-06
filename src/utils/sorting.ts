import { compareISODates } from "../core/date-utils";
import type { Holiday, HolidayCategory } from "../types/holiday";
import type { HolidaySortKey } from "../types/options";

/** Precedence used to order holidays that share a date (lower first). */
export const CATEGORY_PRIORITY: Readonly<Record<HolidayCategory, number>> = Object.freeze({
  general: 0,
  "executive-order": 1,
  bank: 2,
  education: 3,
  corporate: 4,
  custom: 5,
  optional: 6,
  observance: 7,
});

export function compareHolidays(a: Holiday, b: Holiday): number {
  return (
    compareISODates(a.date, b.date) ||
    CATEGORY_PRIORITY[a.category] - CATEGORY_PRIORITY[b.category] ||
    a.id.localeCompare(b.id)
  );
}

/** Order holidays active on the same day: category precedence first, then start date, then id. */
export function compareByPrecedence(a: Holiday, b: Holiday): number {
  return (
    CATEGORY_PRIORITY[a.category] - CATEGORY_PRIORITY[b.category] ||
    compareISODates(a.date, b.date) ||
    a.id.localeCompare(b.id)
  );
}

/** Return a new sorted array. */
export function sortHolidays(holidays: readonly Holiday[], key: HolidaySortKey = "date"): Holiday[] {
  const list = [...holidays];
  switch (key) {
    case "date":
      return list.sort(compareHolidays);
    case "-date":
      return list.sort((a, b) => compareHolidays(b, a));
    case "name":
      return list.sort((a, b) => a.name.localeCompare(b.name) || compareHolidays(a, b));
    case "-name":
      return list.sort((a, b) => b.name.localeCompare(a.name) || compareHolidays(a, b));
    case "category":
      return list.sort(
        (a, b) => CATEGORY_PRIORITY[a.category] - CATEGORY_PRIORITY[b.category] || compareHolidays(a, b),
      );
  }
}
