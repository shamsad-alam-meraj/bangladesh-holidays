import type { CalendarId } from "../types/holiday";
import type { ValidationIssue } from "../types/dataset";

/** Thrown for malformed or impossible dates (e.g. `"2027-02-29"`). */
export class InvalidDateError extends RangeError {
  readonly code = "INVALID_DATE" as const;
  readonly input: unknown;
  constructor(input: unknown, detail?: string) {
    super(
      `Invalid date ${describe(input)}${detail ? `: ${detail}` : ""}. Expected an ISO date string "YYYY-MM-DD" or a valid Date.`,
    );
    this.name = "InvalidDateError";
    this.input = input;
  }
}

/** Thrown when an enabled calendar has no data for the requested year (and `onMissingData` is `"throw"`). */
export class HolidayDataUnavailableError extends Error {
  readonly code = "HOLIDAY_DATA_UNAVAILABLE" as const;
  readonly calendar: CalendarId;
  readonly year: number;
  readonly reason: string | undefined;
  constructor(calendar: CalendarId, year: number, reason?: string) {
    super(
      `No ${calendar} holiday data is available for ${year}.` +
        (reason ? ` ${reason}` : "") +
        ` Supply a dataset via the "datasets" option, or pass onMissingData: "ignore" to treat ${year} as having no ${calendar} holidays.`,
    );
    this.name = "HolidayDataUnavailableError";
    this.calendar = calendar;
    this.year = year;
    this.reason = reason;
  }
}

/** Thrown for invalid or contradictory calendar options. */
export class ConfigurationError extends TypeError {
  readonly code = "INVALID_CONFIGURATION" as const;
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

/** Thrown when a dataset fails validation. */
export class DatasetValidationError extends Error {
  readonly code = "INVALID_DATASET" as const;
  readonly issues: readonly ValidationIssue[];
  constructor(issues: readonly ValidationIssue[], label = "Holiday dataset") {
    const lines = issues.slice(0, 10).map((issue) => `  - ${issue.path}: ${issue.message}`);
    const more = issues.length > 10 ? `\n  …and ${issues.length - 10} more` : "";
    super(`${label} is invalid:\n${lines.join("\n")}${more}`);
    this.name = "DatasetValidationError";
    this.issues = issues;
  }
}

function describe(input: unknown): string {
  if (input instanceof Date) return "Date(Invalid Date)";
  if (typeof input === "string") return JSON.stringify(input);
  return String(input);
}
