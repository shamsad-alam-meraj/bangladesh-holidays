import { diffDays } from "./date-utils";
import { isBanglaLocale } from "../localization";
import type { Holiday, HolidayRecord, LocaleCode } from "../types/holiday";

/** Build a frozen, localized `Holiday` from a record (or re-localize an existing holiday). */
export function localizeHoliday(record: HolidayRecord | Holiday, locale: LocaleCode): Holiday {
  const {
    name: _name,
    description: _description,
    locale: _locale,
    durationDays: _duration,
    ...base
  } = record as Holiday;
  const bangla = isBanglaLocale(locale);
  const name = bangla ? (base.nameBn ?? base.nameEn) : base.nameEn;
  const description = bangla ? (base.descriptionBn ?? base.descriptionEn) : base.descriptionEn;
  const holiday: Holiday = {
    ...base,
    name,
    ...(description !== undefined ? { description } : {}),
    locale,
    durationDays: diffDays(base.date, base.endDate ?? base.date) + 1,
  };
  return Object.freeze(holiday);
}
