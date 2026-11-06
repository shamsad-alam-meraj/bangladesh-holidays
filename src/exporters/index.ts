import { localizeHoliday } from "../core/localize";
import { exportToCsv } from "./csv";
import { exportToIcs } from "./ics";
import { exportToJson } from "./json";
import type { Holiday } from "../types/holiday";
import type { CsvExportOptions, ExportFormat, IcsExportOptions, JsonExportOptions } from "../types/export";

export function exportHolidays(
  holidays: readonly Holiday[],
  format: "json",
  options?: JsonExportOptions,
): string;
export function exportHolidays(
  holidays: readonly Holiday[],
  format: "csv",
  options?: CsvExportOptions,
): string;
export function exportHolidays(
  holidays: readonly Holiday[],
  format: "ics",
  options?: IcsExportOptions,
): string;
/** Export an arbitrary list of holidays (e.g. from `getHolidays()`) to JSON, CSV or ICS. */
export function exportHolidays(
  holidays: readonly Holiday[],
  format: ExportFormat,
  options: JsonExportOptions | CsvExportOptions | IcsExportOptions = {},
): string {
  const list = options.locale
    ? holidays.map((holiday) => localizeHoliday(holiday, options.locale ?? holiday.locale))
    : holidays;
  switch (format) {
    case "json":
      return exportToJson(list, {
        ...((options as JsonExportOptions).indent !== undefined
          ? { indent: (options as JsonExportOptions).indent }
          : {}),
        ...(options.locale ? { meta: { locale: options.locale } } : {}),
      });
    case "csv":
      return exportToCsv(list, options);
    case "ics":
      return exportToIcs(list, options);
    default:
      throw new TypeError(`Unsupported export format: ${String(format)}. Use "json", "csv" or "ics".`);
  }
}

export { exportToCsv, CSV_COLUMNS } from "./csv";
export { exportToIcs, escapeIcsText, foldIcsLine } from "./ics";
export { exportToJson } from "./json";
