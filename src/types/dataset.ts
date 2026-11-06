import type {
  CalendarId,
  Community,
  DateStatus,
  DayType,
  HolidayCategory,
  HolidayRecord,
  HolidaySource,
  HolidayType,
  ISODateString,
  MetadataValue,
  NoticeReference,
  RegionScope,
  VerificationStatus,
} from "./holiday";

/** A holiday entry as written in a dataset JSON file. Omitted fields inherit dataset defaults. */
export interface HolidayRecordInput {
  id: string;
  nameEn: string;
  nameBn?: string;
  date: ISODateString;
  endDate?: ISODateString;
  category: HolidayCategory;
  type: HolidayType;
  dateStatus: DateStatus;
  dayType?: DayType;
  official?: boolean;
  verification?: VerificationStatus;
  descriptionEn?: string;
  descriptionBn?: string;
  source?: HolidaySource;
  announcementDate?: ISODateString;
  regions?: RegionScope;
  communities?: Community[];
  substituteFor?: string;
  notice?: NoticeReference;
  metadata?: Record<string, MetadataValue>;
}

/**
 * Status of a dataset.
 * - `official` — transcribed from an official publication; records default to `official: true, verification: "verified"`.
 * - `provisional` — not yet confirmed by an official publication; records default to `official: false, verification: "unverified"`.
 * - `custom` — organisation-defined data.
 */
export type DatasetStatus = "official" | "provisional" | "custom";

/** A versioned holiday dataset for one calendar and one year (the JSON file format). */
export interface HolidayDatasetInput {
  $schema?: string;
  schemaVersion: 1;
  calendar: CalendarId;
  year: number;
  version: string;
  status: DatasetStatus;
  lastUpdated: ISODateString;
  source?: HolidaySource;
  notes?: string[];
  holidays: HolidayRecordInput[];
}

/** A validated, normalized, frozen dataset. */
export interface HolidayDataset {
  readonly schemaVersion: 1;
  readonly calendar: CalendarId;
  readonly year: number;
  readonly version: string;
  readonly status: DatasetStatus;
  readonly lastUpdated: ISODateString;
  readonly source?: HolidaySource;
  readonly notes: readonly string[];
  readonly holidays: readonly HolidayRecord[];
}

/** Availability of data for one calendar and year. */
export interface DataCoverage {
  readonly calendar: CalendarId;
  readonly year: number;
  readonly status: "available" | "unavailable";
  readonly datasetVersion?: string;
  readonly reason?: string;
  readonly checkedDate?: ISODateString;
  readonly checkedSources?: readonly string[];
}

/** Description of a calendar source. */
export interface CalendarDefinition {
  readonly id: CalendarId;
  readonly nameEn: string;
  readonly nameBn?: string;
  readonly authority?: string;
  readonly authorityUrl?: string;
  readonly descriptionEn?: string;
}

export type ValidationSeverity = "error" | "warning";

export type ValidationCode =
  | "invalid-structure"
  | "missing-field"
  | "invalid-field"
  | "invalid-date"
  | "end-before-start"
  | "year-mismatch"
  | "duplicate-id"
  | "duplicate-holiday"
  | "missing-source"
  | "lunar-without-status"
  | "official-estimate"
  | "overlapping-holidays";

export interface ValidationIssue {
  readonly severity: ValidationSeverity;
  readonly code: ValidationCode;
  readonly message: string;
  /** JSON path of the offending value, e.g. `holidays[3].date`. */
  readonly path: string;
  readonly holidayId?: string;
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly ValidationIssue[];
  readonly warnings: readonly ValidationIssue[];
}
