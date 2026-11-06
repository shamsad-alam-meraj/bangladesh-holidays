/**
 * bangladesh-holidays — Bangladesh holiday calendar and business-day toolkit.
 * @packageDocumentation
 */

export * from "./types";

export { HolidayCalendar } from "./core/calendar";
export {
  createHolidayCalendar,
  getHolidays,
  queryHolidays,
  getHoliday,
  getHolidaysOn,
  getHolidayById,
  isHoliday,
  getHolidaysByType,
  getHolidaysByCategory,
  getHolidaysByMonth,
  getHolidayCount,
  getUpcomingHolidays,
  getNextHoliday,
  getPreviousHoliday,
  getHolidayStatistics,
  getCalendarSummary,
  getDayInfo,
  isWeekend,
  isBusinessDay,
  isWorkingDay,
  addBusinessDays,
  subtractBusinessDays,
  getNextBusinessDay,
  getPreviousBusinessDay,
  countBusinessDays,
  getBusinessDaysBetween,
  getWorkingDays,
  getWeekendDays,
  getLongWeekends,
  suggestLeave,
  getMonthCalendar,
} from "./core/api";
export type { GetHolidaysOptions } from "./core/api";

export { compareHolidayCalendars, findConflictingHolidays, getHolidayChanges } from "./core/compare";
export type { ComparisonRange } from "./core/compare";

export {
  validateHolidayDataset,
  assertValidHolidayDataset,
  normalizeDataset,
  HOLIDAY_CATEGORIES,
  HOLIDAY_TYPES,
  DATE_STATUSES,
  COMMUNITIES,
} from "./core/validation";

export {
  InvalidDateError,
  HolidayDataUnavailableError,
  ConfigurationError,
  DatasetValidationError,
} from "./core/errors";

export {
  toISODate,
  isValidISODate,
  todayInBangladesh,
  isLeapYear,
  addDays,
  getWeekday,
} from "./core/date-utils";

export { localizeHoliday } from "./core/localize";

export { getDataset, getAvailableYears, getDataCoverage, BUILT_IN_CALENDARS } from "./data";

export {
  formatDate,
  formatNumber,
  getMonthName,
  getWeekdayName,
  getCategoryLabel,
  getTypeLabel,
  getDateStatusLabel,
  getCommunityLabel,
  isBanglaLocale,
  isSupportedLocale,
  SUPPORTED_LOCALES,
  toBanglaDigits,
  toLatinDigits,
} from "./localization";
export type { FormatDateOptions } from "./localization";

export {
  toBengaliDate,
  fromBengaliDate,
  formatBengaliDate,
  getBengaliMonthLengths,
  BENGALI_MONTHS_BN,
  BENGALI_MONTHS_EN,
  BENGALI_SEASONS_BN,
  BENGALI_SEASONS_EN,
  BENGALI_CALENDAR_MIN_DATE,
  BENGALI_CALENDAR_MIN_YEAR,
} from "./localization/bengali-calendar";
export type { BengaliDate, FormatBengaliDateOptions } from "./localization/bengali-calendar";

export { exportHolidays, exportToJson, exportToCsv, exportToIcs, CSV_COLUMNS } from "./exporters";

export { VERSION } from "./version";
