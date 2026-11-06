/**
 * Core holiday data types.
 *
 * Dates are always ISO 8601 calendar dates (`YYYY-MM-DD`) with no time or zone.
 */

/** An ISO 8601 calendar date string, `YYYY-MM-DD`. */
export type ISODateString = string;

/** Supported display locales. `bn` and `bn-BD` render Bangla; `en` and `en-BD` render English. */
export type LocaleCode = "en" | "en-BD" | "bn" | "bn-BD";

/** Built-in calendar sources. Custom datasets may use any other identifier. */
export type BuiltInCalendarId = "government" | "bank" | "education";

/** A calendar source identifier (built-in or custom). */
export type CalendarId = BuiltInCalendarId | (string & Record<never, never>);

/**
 * The legal/administrative category of a holiday.
 *
 * - `general` — সাধারণ ছুটি (public holiday)
 * - `executive-order` — নির্বাহী আদেশে ছুটি
 * - `optional` — ঐচ্ছিক ছুটি (individual employees, by religion/community)
 * - `bank` — bank-only holiday
 * - `observance` — national/international day that is not a day off
 * - `education` — educational-institution holiday
 * - `corporate` — organisation-specific holiday
 * - `custom` — any other user-defined holiday
 */
export type HolidayCategory =
  "general" | "executive-order" | "optional" | "bank" | "observance" | "education" | "corporate" | "custom";

/** The nature of a holiday, independent of its legal category. */
export type HolidayType =
  "national" | "religious" | "cultural" | "bank" | "company" | "closure" | "observance" | "other";

/**
 * How certain the date is.
 *
 * - `scheduled` — officially announced date, not flagged as moon-sighting dependent.
 * - `tentative` — officially announced, but explicitly subject to moon sighting / lunar tithi.
 * - `confirmed` — a tentative date confirmed (or revised) by a later official decision.
 * - `estimated` — not officially announced; projected or computed. Never treated as official.
 */
export type DateStatus = "scheduled" | "tentative" | "confirmed" | "estimated";

/** Whether the record has been checked against its primary source. */
export type VerificationStatus = "verified" | "unverified";

/** `full` = whole day off; `half` = half working day. */
export type DayType = "full" | "half";

/** Communities to which optional holidays apply. */
export type Community = "muslim" | "hindu" | "christian" | "buddhist" | "ethnic-minority";

/** Provenance of a holiday record or dataset. */
export interface HolidaySource {
  readonly title: string;
  readonly titleEn?: string;
  readonly authority?: string;
  /** Memo / circular number. */
  readonly reference?: string;
  readonly referenceBn?: string;
  readonly publishedDate?: ISODateString;
  /** Landing page for the source. */
  readonly url?: string;
  /** Direct link to the source document (e.g. PDF). */
  readonly documentUrl?: string;
  readonly retrievedDate?: ISODateString;
}

/**
 * Regional scope. Regions are lowercase identifiers such as district names
 * (`"rangamati"`). A holiday with `include` applies only in those regions; a
 * holiday with `exclude` applies everywhere except those regions.
 */
export interface RegionScope {
  readonly include?: readonly string[];
  readonly exclude?: readonly string[];
}

/** Reference to the row of the official notice a record was transcribed from. */
export interface NoticeReference {
  /** Section label as printed, e.g. `"ক"`. */
  readonly section: string;
  readonly serial: number;
  /** Bangla calendar date(s) exactly as printed, one per day. */
  readonly bengaliDates?: readonly string[];
}

export type MetadataValue = string | number | boolean | null;

/** A canonical, locale-independent holiday record. */
export interface HolidayRecord {
  readonly id: string;
  readonly nameEn: string;
  readonly nameBn?: string;
  readonly date: ISODateString;
  /** Inclusive end date for multi-day holidays. */
  readonly endDate?: ISODateString;
  readonly category: HolidayCategory;
  readonly type: HolidayType;
  readonly calendar: CalendarId;
  readonly dayType: DayType;
  readonly dateStatus: DateStatus;
  /** True when the record comes from an official government/Bangladesh Bank publication. */
  readonly official: boolean;
  readonly verification: VerificationStatus;
  readonly descriptionEn?: string;
  readonly descriptionBn?: string;
  readonly source?: HolidaySource;
  readonly announcementDate?: ISODateString;
  readonly regions?: RegionScope;
  /** Optional holidays: the communities they apply to. */
  readonly communities?: readonly Community[];
  /** For substitute holidays: the id of the holiday being substituted. */
  readonly substituteFor?: string;
  readonly notice?: NoticeReference;
  readonly metadata?: Readonly<Record<string, MetadataValue>>;
}

/** A holiday as returned by the API: a record plus localized display fields. */
export interface Holiday extends HolidayRecord {
  /** Display name in the requested locale (falls back to English). */
  readonly name: string;
  /** Description in the requested locale, when available. */
  readonly description?: string;
  readonly locale: LocaleCode;
  /** Number of calendar days from `date` to `endDate` inclusive. */
  readonly durationDays: number;
}
