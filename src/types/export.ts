import type { DateInput } from "./options";
import type { LocaleCode } from "./holiday";

export type ExportFormat = "json" | "csv" | "ics";

export interface ExportRangeOptions {
  /** Year to export. Defaults to the calendar's `year`. */
  readonly year?: number;
  /** Export holidays overlapping `[from, to]` instead of a single year. */
  readonly from?: DateInput;
  readonly to?: DateInput;
  /** Defaults to the calendar locale. */
  readonly locale?: LocaleCode;
}

export interface JsonExportOptions extends ExportRangeOptions {
  /** Indentation; default 2. Use 0 for compact output. */
  readonly indent?: number;
}

export interface CsvExportOptions extends ExportRangeOptions {
  /** Prepend a UTF-8 byte-order mark so Excel detects Bangla text. Default `false`. */
  readonly bom?: boolean;
  /** Field delimiter. Default `","`. */
  readonly delimiter?: "," | ";" | "\t";
  /** Prefix values starting with `= + - @` to prevent spreadsheet formula injection. Default `true`. */
  readonly escapeFormulas?: boolean;
}

/** An alarm attached to every exported event. */
export interface IcsReminder {
  /** Minutes before the start of the (all-day) event. 1440 = the day before at 00:00. */
  readonly minutesBefore: number;
  /** Alarm text. Defaults to the event summary. */
  readonly description?: string;
}

export interface IcsExportOptions extends ExportRangeOptions {
  /** `X-WR-CALNAME`. Default "Bangladesh Holidays". */
  readonly calendarName?: string;
  readonly reminders?: readonly IcsReminder[];
  /** `DTSTAMP` for every event. Defaults to the current time; pass a fixed value for reproducible output. */
  readonly timestamp?: Date;
  /** Domain used in event UIDs. Default `"bangladesh-holidays"`. */
  readonly uidDomain?: string;
  /** Mark events as busy (`OPAQUE`). Default `false` (`TRANSPARENT`). */
  readonly busy?: boolean;
  /** `X-WR-CALDESC` shown by calendar apps. */
  readonly calendarDescription?: string;
  /**
   * For subscribed feeds: how often clients should re-fetch, in hours
   * (`REFRESH-INTERVAL` / `X-PUBLISHED-TTL`). Omitted by default.
   */
  readonly refreshIntervalHours?: number;
}

export type ExportOptions = JsonExportOptions | CsvExportOptions | IcsExportOptions;
