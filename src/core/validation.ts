import { compareISODates, isValidISODate, yearOf } from "./date-utils";
import { DatasetValidationError } from "./errors";
import { deepFreeze } from "../utils/freeze";
import type {
  HolidayDataset,
  HolidayDatasetInput,
  ValidationCode,
  ValidationIssue,
  ValidationResult,
} from "../types/dataset";
import type {
  Community,
  DateStatus,
  DayType,
  HolidayCategory,
  HolidayRecord,
  HolidayType,
  VerificationStatus,
} from "../types/holiday";

export const HOLIDAY_CATEGORIES: readonly HolidayCategory[] = Object.freeze([
  "general",
  "executive-order",
  "optional",
  "bank",
  "observance",
  "education",
  "corporate",
  "custom",
]);
export const HOLIDAY_TYPES: readonly HolidayType[] = Object.freeze([
  "national",
  "religious",
  "cultural",
  "bank",
  "company",
  "closure",
  "observance",
  "other",
]);
export const DATE_STATUSES: readonly DateStatus[] = Object.freeze([
  "scheduled",
  "tentative",
  "confirmed",
  "estimated",
]);
export const DAY_TYPES: readonly DayType[] = Object.freeze(["full", "half"]);
export const COMMUNITIES: readonly Community[] = Object.freeze([
  "muslim",
  "hindu",
  "christian",
  "buddhist",
  "ethnic-minority",
]);
const VERIFICATION_STATUSES: readonly VerificationStatus[] = ["verified", "unverified"];
const DATASET_STATUSES = ["official", "provisional", "custom"] as const;
const ID_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;
const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;
const MOON_WORDS = /moon|চাঁদ|lunar|চান্দ্র/i;

type UnknownRecord = Record<string, unknown>;

function isObject(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

class IssueCollector {
  readonly errors: ValidationIssue[] = [];
  readonly warnings: ValidationIssue[] = [];
  error(code: ValidationCode, path: string, message: string, holidayId?: string): void {
    this.errors.push(issue("error", code, path, message, holidayId));
  }
  warn(code: ValidationCode, path: string, message: string, holidayId?: string): void {
    this.warnings.push(issue("warning", code, path, message, holidayId));
  }
  result(): ValidationResult {
    return deepFreeze({
      valid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
    });
  }
}

function issue(
  severity: ValidationIssue["severity"],
  code: ValidationCode,
  path: string,
  message: string,
  holidayId?: string,
): ValidationIssue {
  return holidayId === undefined
    ? { severity, code, path, message }
    : { severity, code, path, message, holidayId };
}

function checkString(
  issues: IssueCollector,
  obj: UnknownRecord,
  key: string,
  path: string,
  required: boolean,
  id?: string,
): void {
  const value = obj[key];
  if (value === undefined) {
    if (required) issues.error("missing-field", `${path}.${key}`, `"${key}" is required`, id);
    return;
  }
  if (typeof value !== "string" || value.trim() === "") {
    issues.error("invalid-field", `${path}.${key}`, `"${key}" must be a non-empty string`, id);
  }
}

function checkEnum(
  issues: IssueCollector,
  obj: UnknownRecord,
  key: string,
  allowed: readonly string[],
  path: string,
  required: boolean,
  id?: string,
): void {
  const value = obj[key];
  if (value === undefined) {
    if (required) issues.error("missing-field", `${path}.${key}`, `"${key}" is required`, id);
    return;
  }
  if (typeof value !== "string" || !allowed.includes(value)) {
    issues.error(
      "invalid-field",
      `${path}.${key}`,
      `"${key}" must be one of ${allowed.map((v) => `"${v}"`).join(", ")}; got ${JSON.stringify(value)}`,
      id,
    );
  }
}

function checkDate(
  issues: IssueCollector,
  obj: UnknownRecord,
  key: string,
  path: string,
  required: boolean,
  id?: string,
): boolean {
  const value = obj[key];
  if (value === undefined) {
    if (required) issues.error("missing-field", `${path}.${key}`, `"${key}" is required`, id);
    return false;
  }
  if (!isValidISODate(value)) {
    issues.error(
      "invalid-date",
      `${path}.${key}`,
      `"${key}" must be a valid YYYY-MM-DD date; got ${JSON.stringify(value)}`,
      id,
    );
    return false;
  }
  return true;
}

function checkStringArray(
  issues: IssueCollector,
  value: unknown,
  path: string,
  allowed?: readonly string[],
  id?: string,
): void {
  if (!Array.isArray(value) || value.length === 0) {
    issues.error("invalid-field", path, "must be a non-empty array of strings", id);
    return;
  }
  value.forEach((item, index) => {
    if (typeof item !== "string" || item === "" || (allowed && !allowed.includes(item))) {
      issues.error(
        "invalid-field",
        `${path}[${index}]`,
        allowed ? `must be one of ${allowed.join(", ")}` : "must be a non-empty string",
        id,
      );
    }
  });
}

function checkSource(issues: IssueCollector, value: unknown, path: string, id?: string): void {
  if (value === undefined) return;
  if (!isObject(value)) {
    issues.error("invalid-field", path, "source must be an object", id);
    return;
  }
  checkString(issues, value, "title", path, true, id);
  for (const key of ["titleEn", "authority", "reference", "referenceBn"]) {
    checkString(issues, value, key, path, false, id);
  }
  for (const key of ["url", "documentUrl"]) {
    const url = value[key];
    if (url !== undefined && (typeof url !== "string" || !/^https?:\/\/\S+$/.test(url))) {
      issues.error("invalid-field", `${path}.${key}`, `"${key}" must be an http(s) URL`, id);
    }
  }
  for (const key of ["publishedDate", "retrievedDate"]) checkDate(issues, value, key, path, false, id);
}

function validateHolidayEntry(
  issues: IssueCollector,
  entry: unknown,
  index: number,
  datasetYear: number | undefined,
  datasetHasSource: boolean,
  datasetStatus: unknown,
): void {
  const path = `holidays[${index}]`;
  if (!isObject(entry)) {
    issues.error("invalid-structure", path, "holiday entry must be an object");
    return;
  }
  const id = typeof entry.id === "string" ? entry.id : undefined;
  if (id === undefined) {
    issues.error("missing-field", `${path}.id`, '"id" is required');
  } else if (!ID_PATTERN.test(id)) {
    issues.error(
      "invalid-field",
      `${path}.id`,
      '"id" must be lowercase letters, digits, ".", "_" or "-"',
      id,
    );
  }
  checkString(issues, entry, "nameEn", path, true, id);
  checkString(issues, entry, "nameBn", path, false, id);
  checkString(issues, entry, "descriptionEn", path, false, id);
  checkString(issues, entry, "descriptionBn", path, false, id);
  checkString(issues, entry, "substituteFor", path, false, id);
  checkEnum(issues, entry, "category", HOLIDAY_CATEGORIES, path, true, id);
  checkEnum(issues, entry, "type", HOLIDAY_TYPES, path, true, id);
  checkEnum(issues, entry, "dateStatus", DATE_STATUSES, path, true, id);
  checkEnum(issues, entry, "dayType", DAY_TYPES, path, false, id);
  checkEnum(issues, entry, "verification", VERIFICATION_STATUSES, path, false, id);
  if (entry.official !== undefined && typeof entry.official !== "boolean") {
    issues.error("invalid-field", `${path}.official`, '"official" must be a boolean', id);
  }
  const hasDate = checkDate(issues, entry, "date", path, true, id);
  const hasEnd = checkDate(issues, entry, "endDate", path, false, id);
  checkDate(issues, entry, "announcementDate", path, false, id);
  if (hasDate && hasEnd && compareISODates(entry.endDate as string, entry.date as string) < 0) {
    issues.error("end-before-start", `${path}.endDate`, "endDate is before date", id);
  }
  if (hasDate && datasetYear !== undefined && yearOf(entry.date as string) !== datasetYear) {
    issues.error(
      "year-mismatch",
      `${path}.date`,
      `date ${String(entry.date)} is outside dataset year ${datasetYear}`,
      id,
    );
  }
  if (entry.communities !== undefined) {
    checkStringArray(issues, entry.communities, `${path}.communities`, COMMUNITIES, id);
  }
  if (entry.regions !== undefined) {
    if (!isObject(entry.regions)) {
      issues.error("invalid-field", `${path}.regions`, "regions must be an object", id);
    } else {
      const { include, exclude } = entry.regions;
      if (include === undefined && exclude === undefined) {
        issues.error("invalid-field", `${path}.regions`, 'regions needs "include" or "exclude"', id);
      }
      if (include !== undefined) checkStringArray(issues, include, `${path}.regions.include`, undefined, id);
      if (exclude !== undefined) checkStringArray(issues, exclude, `${path}.regions.exclude`, undefined, id);
    }
  }
  if (entry.metadata !== undefined) {
    if (!isObject(entry.metadata)) {
      issues.error("invalid-field", `${path}.metadata`, "metadata must be an object", id);
    } else {
      for (const [key, value] of Object.entries(entry.metadata)) {
        if (value !== null && !["string", "number", "boolean"].includes(typeof value)) {
          issues.error(
            "invalid-field",
            `${path}.metadata.${key}`,
            "metadata values must be string, number, boolean or null",
            id,
          );
        }
      }
    }
  }
  if (entry.notice !== undefined) {
    const notice = entry.notice;
    if (!isObject(notice) || typeof notice.section !== "string" || typeof notice.serial !== "number") {
      issues.error("invalid-field", `${path}.notice`, "notice needs a string section and numeric serial", id);
    } else if (notice.bengaliDates !== undefined) {
      checkStringArray(issues, notice.bengaliDates, `${path}.notice.bengaliDates`, undefined, id);
    }
  }
  checkSource(issues, entry.source, `${path}.source`, id);

  const official = entry.official ?? datasetStatus === "official";
  if (official === true && entry.source === undefined && !datasetHasSource) {
    issues.error("missing-source", `${path}.source`, "official holidays must cite a source", id);
  }
  if (official === true && entry.dateStatus === "estimated") {
    issues.error(
      "official-estimate",
      `${path}.dateStatus`,
      'an official record cannot have dateStatus "estimated"; set official: false',
      id,
    );
  }
  if (entry.dateStatus === "scheduled" && entry.type === "religious") {
    const text = [entry.descriptionEn, entry.descriptionBn]
      .filter((value): value is string => typeof value === "string")
      .join(" ");
    if (MOON_WORDS.test(text)) {
      issues.warn(
        "lunar-without-status",
        `${path}.dateStatus`,
        'description mentions moon sighting but dateStatus is "scheduled"; consider "tentative"',
        id,
      );
    }
  }
}

/**
 * Validate a dataset (e.g. parsed JSON) against the dataset schema.
 * Never throws; returns all errors and warnings.
 */
export function validateHolidayDataset(input: unknown): ValidationResult {
  const issues = new IssueCollector();
  if (!isObject(input)) {
    issues.error("invalid-structure", "$", "dataset must be an object");
    return issues.result();
  }
  if (input.schemaVersion !== 1) {
    issues.error("invalid-field", "schemaVersion", "schemaVersion must be 1");
  }
  checkString(issues, input, "calendar", "$", true);
  if (typeof input.calendar === "string" && !ID_PATTERN.test(input.calendar)) {
    issues.error("invalid-field", "calendar", "calendar must be a lowercase identifier");
  }
  const year = input.year;
  const validYear = typeof year === "number" && Number.isInteger(year) && year >= 1 && year <= 9999;
  if (!validYear) issues.error("invalid-field", "year", "year must be an integer between 1 and 9999");
  if (typeof input.version !== "string" || !SEMVER_PATTERN.test(input.version)) {
    issues.error("invalid-field", "version", 'version must look like "2027.1.0"');
  }
  checkEnum(issues, input, "status", DATASET_STATUSES, "$", true);
  checkDate(issues, input, "lastUpdated", "$", true);
  checkSource(issues, input.source, "source");
  if (input.notes !== undefined) {
    if (!Array.isArray(input.notes) || input.notes.some((note) => typeof note !== "string")) {
      issues.error("invalid-field", "notes", "notes must be an array of strings");
    }
  }
  if (!Array.isArray(input.holidays)) {
    issues.error("invalid-structure", "holidays", "holidays must be an array");
    return issues.result();
  }

  const datasetYear = validYear ? year : undefined;
  const ids = new Map<string, number>();
  const keys = new Map<string, number>();
  input.holidays.forEach((entry, index) => {
    validateHolidayEntry(issues, entry, index, datasetYear, input.source !== undefined, input.status);
    if (!isObject(entry)) return;
    if (typeof entry.id === "string") {
      const previous = ids.get(entry.id);
      if (previous !== undefined) {
        issues.error(
          "duplicate-id",
          `holidays[${index}].id`,
          `duplicate id "${entry.id}" (also at holidays[${previous}])`,
          entry.id,
        );
      } else {
        ids.set(entry.id, index);
      }
    }
    if (typeof entry.date === "string" && typeof entry.nameEn === "string") {
      const endDate = typeof entry.endDate === "string" ? entry.endDate : "";
      const category = typeof entry.category === "string" ? entry.category : "";
      const key = `${entry.date}|${endDate}|${entry.nameEn.toLowerCase()}|${category}`;
      const previous = keys.get(key);
      if (previous !== undefined) {
        issues.error(
          "duplicate-holiday",
          `holidays[${index}]`,
          `same holiday as holidays[${previous}] (same name, category and dates)`,
          typeof entry.id === "string" ? entry.id : undefined,
        );
      } else {
        keys.set(key, index);
      }
    }
  });
  return issues.result();
}

/** Validate and throw `DatasetValidationError` on failure. */
export function assertValidHolidayDataset(
  input: unknown,
  label?: string,
): asserts input is HolidayDatasetInput {
  const result = validateHolidayDataset(input);
  if (!result.valid) throw new DatasetValidationError(result.errors, label);
}

/** Validate, apply dataset-level defaults, and deep-freeze. */
export function normalizeDataset(input: unknown, label?: string): HolidayDataset {
  assertValidHolidayDataset(input, label);
  const official = input.status === "official";
  const holidays: HolidayRecord[] = input.holidays.map((entry) => {
    const { source: entrySource, announcementDate: entryAnnouncement, ...rest } = entry;
    const source = entrySource ?? input.source;
    const announcementDate = entryAnnouncement ?? input.source?.publishedDate;
    const record: HolidayRecord = {
      ...rest,
      calendar: input.calendar,
      dayType: entry.dayType ?? "full",
      official: entry.official ?? official,
      verification: entry.verification ?? (official ? "verified" : "unverified"),
      ...(source !== undefined ? { source } : {}),
      ...(announcementDate !== undefined ? { announcementDate } : {}),
    };
    return record;
  });
  holidays.sort((a, b) => compareISODates(a.date, b.date) || a.id.localeCompare(b.id));
  const dataset: HolidayDataset = {
    schemaVersion: 1,
    calendar: input.calendar,
    year: input.year,
    version: input.version,
    status: input.status,
    lastUpdated: input.lastUpdated,
    ...(input.source ? { source: input.source } : {}),
    notes: input.notes ?? [],
    holidays,
  };
  return deepFreeze(structuredCloneJson(dataset));
}

/** JSON-safe deep clone so callers' objects are never frozen or shared. */
function structuredCloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
