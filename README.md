# bangladesh-holidays

Bangladesh holiday calendar and business-day toolkit for TypeScript and JavaScript — with the **official 2027 government holiday list**, Bangla localization, a revised Bangla (বঙ্গাব্দ) calendar converter, and JSON / CSV / iCalendar export.

[![CI](https://github.com/shamsad-alam-meraj/bangladesh-holidays/actions/workflows/ci.yml/badge.svg)](https://github.com/shamsad-alam-meraj/bangladesh-holidays/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/bangladesh-holidays.svg)](https://www.npmjs.com/package/bangladesh-holidays)
[![license](https://img.shields.io/npm/l/bangladesh-holidays.svg)](LICENSE)

```ts
import { getHoliday, isBusinessDay, addBusinessDays } from "bangladesh-holidays";

getHoliday("2027-03-26", { locale: "bn-BD" })?.name; // "স্বাধীনতা ও জাতীয় দিবস"
isBusinessDay("2027-03-10"); // false — Eid-ul-Fitr
addBusinessDays("2027-03-04", 1); // "2027-03-14" — skips the 9-day Eid break
```

## Contents

- [Features](#features)
- [Data status](#data-status)
- [Installation](#installation)
- [Quick start](#quick-start)
- [Core concepts](#core-concepts)
- [Custom calendars](#custom-calendars)
- [Working-day calculations](#working-day-calculations)
- [Bangla localization](#bangla-localization)
- [Export](#export)
- [Integration examples](#integration-examples)
- [API reference](#api-reference)
- [Dataset format and contributing data](#dataset-format-and-contributing-data)
- [Compatibility](#compatibility)
- [Data accuracy disclaimer](#data-accuracy-disclaimer)
- [Roadmap](#roadmap)
- [Contributing](#contributing) · [License](#license)

## Features

- **Official data with provenance.** Every 2027 record is transcribed from the Ministry of Public Administration notification and carries its memo number, source URL and announcement date. General (সাধারণ) and executive-order (নির্বাহী আদেশে) holidays are kept distinct, and optional (ঐচ্ছিক) holidays are tagged by community.
- **Honest about uncertainty.** Moon-sighting-dependent dates are `tentative`; calendars with no published data (e.g. Bangladesh Bank 2027) are reported as **unavailable**, and by default the library throws rather than silently treating unknown days as working days.
- **Business days.** Add or subtract business days, count them (inclusive or exclusive), list working days, and find long weekends. Custom weekends, half days, closures and working-day overrides are all respected.
- **Customizable calendars.** Custom, recurring and date-range holidays; organisation datasets; regional holidays; per-community optional holidays; moon-sighting date overrides; and documented precedence rules. Calendars are immutable.
- **Bangla first.** Bangla names and descriptions, Bangla numerals, notice-style date formatting (`শুক্রবার, ২৬ মার্চ ২০২৭`), and a converter for the revised Bangla calendar that is verified against the official notice.
- **Export.** JSON, RFC 4180 CSV (Excel-safe, formula-injection guarded) and RFC 5545 iCalendar with reminders. The ICS output is built for Google Calendar, Outlook and Apple Calendar import.
- **Engineering.** Zero runtime dependencies; ESM + CommonJS + full TypeScript declarations; tree-shakable; timezone-safe date-only arithmetic. 300+ tests at ≈97% statement coverage.

## Data status

| Calendar                                                      | 2027               | Source                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `government` — general, executive-order and optional holidays | ✅ **Official**    | MoPA notification no. ০৫.০০.০০০০.১৭৫.০৮.০০০৮.২৫-১০৫, dated 05 Nov 2026 ([notice page](https://mopa.gov.bd/pages/go-ultimates/6aec1a0f47e3ef92265ec740), [PDF](https://objectstorage.ap-dcc-gazipur-1.oraclecloud15.com/n/axvjbnqprylg/b/V2Ministry/o/office-mopa/2026/10/0bb0494a-07d8-445a-a4c4-e60fadbd406d.pdf)); Cabinet approval 02 Nov 2026 |
| `bank` — Bangladesh Bank                                      | ⛔ **Unavailable** | Not published as of 06 Nov 2026 (the 2026 list came out on 16 Nov 2025). Not inferred from the government list.                                                                                                                                                                                                                                   |
| `education`                                                   | ⛔ **Not bundled** | Published separately by education authorities and institutions; supply it as a custom dataset.                                                                                                                                                                                                                                                    |

**2027 at a glance** (national scope): 15 general holiday days (4 fall on Fri/Sat) and 14 executive-order holiday days (3 on Fri/Sat). The notice counts these as 22 effective days off. There are actually **21 distinct weekdays**, because 20 May is both Buddha Purnima and the third day after Eid-ul-Azha. Chaitra Sankranti (13 April) is a general holiday **only** in the Rangamati, Khagrachari and Bandarban hill districts.

```ts
import { getDataCoverage } from "bangladesh-holidays";
getDataCoverage({ year: 2027 }); // [{ calendar: "government", status: "available", … }, { calendar: "bank", status: "unavailable", reason: "…" }, …]
```

## Installation

```sh
npm install bangladesh-holidays
# or: pnpm add bangladesh-holidays · yarn add bangladesh-holidays
```

## Quick start

```ts
import {
  getHolidays,
  getHoliday,
  isHoliday,
  getHolidaysByType,
  createHolidayCalendar,
  isBusinessDay,
  addBusinessDays,
  countBusinessDays,
  getLongWeekends,
} from "bangladesh-holidays";

getHolidays(2027); // 23 general + executive-order holidays (national scope)
getHolidays({ year: 2027, month: 3, calendar: "government", locale: "en" });
getHolidaysByType(2027, "religious");
getHoliday("2027-03-26"); // { name: "Independence and National Day", date: "2027-03-26", category: "general", … }
isHoliday("2027-03-26"); // true

isBusinessDay("2027-03-14"); // true
addBusinessDays("2027-05-13", 3); // "2027-05-25"
countBusinessDays("2027-03-01", "2027-03-31"); // 18
getLongWeekends(2027); // [{ startDate: "2027-01-22", endDate: "2027-01-24", days: 3, … }, …]

const calendar = createHolidayCalendar({ year: 2027, locale: "bn-BD" });
calendar.export("ics");
```

A returned holiday looks like this (frozen object):

```ts
{
  id: "2027-eid-ul-fitr",
  name: "Eid-ul-Fitr",            // in the requested locale
  nameEn: "Eid-ul-Fitr",
  nameBn: "ঈদ-উল-ফিতর",
  date: "2027-03-10",
  durationDays: 1,
  category: "general",            // general | executive-order | optional | bank | observance | education | corporate | custom
  type: "religious",              // national | religious | cultural | bank | company | closure | observance | other
  calendar: "government",
  dayType: "full",                // full | half
  dateStatus: "tentative",        // scheduled | tentative | confirmed | estimated
  official: true,
  verification: "verified",
  description: "Festival marking the end of Ramadan. The date depends on moon sighting.",
  source: { reference: "05.00.0000.175.08.0008.25-105", url: "https://mopa.gov.bd/…", publishedDate: "2026-11-05", … },
  announcementDate: "2026-11-05",
  notice: { section: "ক", serial: 3, bengaliDates: ["২৫ ফাল্গুন ১৪৩৩"] },
  locale: "en"
}
```

## Core concepts

**Dates.** Pass ISO `YYYY-MM-DD` strings (recommended); every function returns them too. Strings are validated strictly (`"2027-02-29"` throws `InvalidDateError`), and all arithmetic is integer day-number math, so results never shift with the host time zone or DST. `Date` objects are accepted and never mutated. By default they are read as the calendar date **in Bangladesh (UTC+06:00)** at that instant; set `dateInterpretation: "utc"` or `"local"` to change this.

**Categories vs. types.** `category` is the legal status (general, executive-order, optional, …); `type` is the nature (national, religious, cultural, …).

**Date status.** `scheduled` = officially fixed; `tentative` = officially announced but subject to moon sighting (marked with \* in the notice); `confirmed` = a tentative date confirmed or moved by a later decision; `estimated` = not official. Official records can never be `estimated`.

**Default calendar.** Functions called without options use: the `government` calendar, general + executive-order holidays, Friday/Saturday weekend, national scope (regional holidays excluded), English names, and `onMissingData: "throw"`.

**Missing data.** If a date falls in a year that an enabled calendar has no data for, the library throws `HolidayDataUnavailableError` (with `.calendar`, `.year` and `.reason`). This stops a payroll run from treating unknown holidays as working days. Pass `onMissingData: "ignore"` to treat such years as having no holidays from that calendar.

```ts
isHoliday("2028-01-02"); // throws HolidayDataUnavailableError: No government holiday data is available for 2028…
isHoliday("2028-01-02", { onMissingData: "ignore" }); // false
```

## Custom calendars

```ts
import { createHolidayCalendar } from "bangladesh-holidays";

const calendar = createHolidayCalendar({
  year: 2027,
  locale: "bn-BD",
  weekend: [5, 6], // 0 = Sunday … 6 = Saturday
  calendars: ["government"], // add "bank" once Bangladesh Bank data is available
  includeOptionalHolidays: false,
  optionalHolidayCommunities: ["hindu"], // when optional holidays are included
  includeObservances: false,
  region: undefined, // e.g. "rangamati" for hill-district holidays, or "all"
  customHolidays: [
    {
      date: "2027-06-01",
      name: "Company Foundation Day",
      nameBn: "কোম্পানি প্রতিষ্ঠা দিবস",
      type: "company",
    },
    {
      id: "office-move",
      date: "2027-07-05",
      endDate: "2027-07-07",
      name: "Office relocation",
      type: "closure",
    },
    { date: "2027-09-30", name: "Quarter-end", dayType: "half" },
  ],
  recurringHolidays: [{ id: "sports-day", month: 1, day: 28, name: "Annual Sports Day" }],
  holidayOverrides: [], // move dataset holidays, e.g. after moon sighting
  excludedDates: [], // ignore all holidays on these dates
  excludedHolidayIds: [],
  workingDayOverrides: ["2027-03-27"], // make-up working day
  halfDayIsBusinessDay: true,
  onMissingData: "throw",
});
```

> Including `"bank"` in `calendars` currently throws for 2027 because Bangladesh Bank has not yet published its list. Use `onMissingData: "ignore"` to proceed anyway, or load your own bank dataset with `datasets`.

### Precedence rules

To decide whether a date is a business day (highest priority first):

1. **`workingDayOverrides`** — always a business day, even on a weekend or holiday.
2. **Full-day holidays** — not a business day. Holidays come from enabled datasets (after `holidayOverrides` move them), custom holidays and recurring holidays. `excludedDates` and `excludedHolidayIds` remove holidays before this step.
3. **Weekend days** — not a business day.
4. **Half-day holidays** — a business day unless `halfDayIsBusinessDay: false`.
5. Otherwise a business day.

When several holidays fall on one date, `getHoliday()` returns the highest-precedence one (general → executive-order → bank → education → corporate → custom → optional) and `getHolidaysOn()` returns them all. `getDayInfo(date)` explains the decision through its `reason` field.

Contradictory settings throw `ConfigurationError` at construction. Examples: a date listed both as a custom holiday and in `workingDayOverrides`; the same holiday overridden twice; an override or exclusion naming an unknown id; duplicate custom ids; an invalid weekend.

### Runtime updates

Calendars are immutable; update methods return a new calendar:

```ts
const updated = calendar
  .addCustomHolidays({ date: "2027-08-10", name: "Offsite" })
  .addWorkingDayOverrides("2027-05-15")
  .addExcludedDates("2027-12-16")
  .excludeHolidays("sports-day")
  .setLocale("en")
  .setWeekend([5])
  .with({ includeOptionalHolidays: true });
```

### Moon-sighting updates

The government notice marks Islamic and some Buddhist dates as subject to moon sighting. When the moon-sighting committee shifts a date, apply the new government schedule:

```ts
const confirmed = calendar.overrideHolidayDates(
  { id: "2027-eid-ul-fitr", date: "2027-03-11" },
  { id: "2027-eid-ul-fitr-before", date: "2027-03-09", endDate: "2027-03-10" },
  { id: "2027-eid-ul-fitr-after", date: "2027-03-12", endDate: "2027-03-13" },
);
confirmed.getHoliday("2027-03-11"); // { id: "2027-eid-ul-fitr", dateStatus: "confirmed", metadata: { originalDate: "2027-03-10" }, … }
```

### Custom datasets

Load organisation or regional calendars from JSON. They're validated on load (see [schema](schema/holiday-dataset.schema.json)), and their calendar is enabled automatically. A custom dataset with the same calendar and year as a bundled one replaces it, so you can hot-fix data before a package update.

```ts
import branch2027 from "./holidays/chattogram-branch-2027.json" with { type: "json" };
const calendar = createHolidayCalendar({ datasets: [branch2027] });
```

### Optional holidays and regions

```ts
// A Hindu employee's calendar including their optional holidays.
createHolidayCalendar({ includeOptionalHolidays: true, optionalHolidayCommunities: ["hindu"] });

// Offices in the hill districts (adds Chaitra Sankranti on 13 April).
createHolidayCalendar({ region: "rangamati" });
```

Under the notice, an employee may take at most 3 optional days a year, with prior approval. This library lists the options; enforcing the quota is up to your application.

## Working-day calculations

```ts
import {
  isBusinessDay,
  isWorkingDay,
  isWeekend,
  getDayInfo,
  addBusinessDays,
  subtractBusinessDays,
  getNextBusinessDay,
  getPreviousBusinessDay,
  countBusinessDays,
  getBusinessDaysBetween,
  getWorkingDays,
  getWeekendDays,
  getLongWeekends,
} from "bangladesh-holidays";

addBusinessDays("2027-03-04", 1); // "2027-03-14"
addBusinessDays("2027-03-14", -1); // "2027-03-04" (negative = backwards)
addBusinessDays("2027-03-26", 0); // "2027-03-26" (zero returns the input unchanged)
subtractBusinessDays("2027-03-14", 1); // "2027-03-04"
getNextBusinessDay("2027-12-15"); // "2027-12-19"

countBusinessDays("2027-03-14", "2027-03-18"); // 5 — both ends included by default
countBusinessDays("2027-03-14", "2027-03-18", { includeStart: false }); // 4
getBusinessDaysBetween("2027-03-03", "2027-03-16"); // ["2027-03-03", "2027-03-04", "2027-03-14", …]

getWorkingDays(2027, 3).length; // 18
getWorkingDays(2027).length; // 240
getWeekendDays(2027, { weekend: [5] }).length; // 53

getLongWeekends(2027, { minDays: 5 });
// [{ startDate: "2027-03-05", endDate: "2027-03-13", days: 9, holidays: [...] }, { startDate: "2027-05-14", … }]

createHolidayCalendar().rollToBusinessDay("2027-12-16"); // "2027-12-19"
```

Every function accepts calendar options as its last argument, e.g. `isBusinessDay(date, { weekend: [5], customHolidays: [...] })`. For repeated calls, create a calendar once; it caches per-year indexes.

## Bangla localization

Supported locales: `en`, `en-BD`, `bn`, `bn-BD`.

```ts
import {
  getHoliday,
  getHolidays,
  formatDate,
  formatBengaliDate,
  toBengaliDate,
  fromBengaliDate,
  toBanglaDigits,
  toLatinDigits,
  getCategoryLabel,
} from "bangladesh-holidays";

getHoliday("2027-03-26", { locale: "bn-BD" });
// { name: "স্বাধীনতা ও জাতীয় দিবস", date: "2027-03-26", description: "১৯৭১ সালে বাংলাদেশের স্বাধীনতা ঘোষণার বার্ষিকী।", … }

formatDate("2027-03-05", "bn-BD", { weekday: true }); // "শুক্রবার, ০৫ মার্চ ২০২৭" (official notice style)
formatDate("2027-03-05", "en"); // "5 March 2027"
toBanglaDigits(2027); // "২০২৭"
toLatinDigits("২০২৭-০৩-২৬"); // "2027-03-26"
getCategoryLabel("executive-order", "bn"); // "নির্বাহী আদেশে ছুটি"

formatBengaliDate("2027-03-26"); // "১২ চৈত্র ১৪৩৩"
toBengaliDate("2027-04-14"); // { year: 1434, month: 1, day: 1, monthNameBn: "বৈশাখ", formattedEn: "1 Boishakh 1434", … }
fromBengaliDate(1433, 12, 12); // "2027-03-26"
```

**Bangla calendar scope.** The converter implements the **revised Bangla calendar used officially in Bangladesh since 1426 BS** (14 April 2019): 1 Boishakh = 14 April; Boishakh–Ashwin have 31 days; Kartik–Magh and Chaitra have 30; Falgun has 29, or 30 when it contains 29 February. It is tested against every Bangla date printed in the 2027 notice. Dates before 14 April 2019 throw a `RangeError` rather than being converted with the wrong rules. It is **not** the traditional panjika calendar used in West Bengal.

## Export

```ts
const calendar = createHolidayCalendar({ year: 2027, locale: "bn-BD" });

calendar.export("json"); // { generator, locale, from, to, coverage, count, holidays: [...] }
calendar.export("csv", { bom: true }); // Excel-friendly UTF-8 with BOM; also delimiter: ";" | "\t"
calendar.export("ics", {
  calendarName: "বাংলাদেশ সরকারি ছুটি ২০২৭",
  reminders: [{ minutesBefore: 24 * 60 }], // VALARM the day before
  busy: false, // TRANSPARENT (default) or OPAQUE/out-of-office
});
calendar.export("ics", { from: "2027-03-01", to: "2027-05-31", locale: "en" });
```

- **ICS** follows RFC 5545: CRLF line endings; 75-octet folding that never splits a Bangla character; all-day `VALUE=DATE` events with an exclusive `DTEND`; stable `UID`s; `CATEGORIES`; `STATUS:TENTATIVE` for moon-dependent dates; and the Outlook all-day/busy-status properties. Import it via Google Calendar → _Settings → Import_, Outlook → _Add calendar → Upload from file_, or open it in Apple Calendar.
- **CSV** follows RFC 4180. Values starting with `= + - @` get a `'` prefix to block spreadsheet formula injection (`escapeFormulas: false` disables this).
- `exportHolidays(holidays, format, options)` exports any list of holidays, e.g. a filtered `getHolidays()` result.

## Integration examples

Everything under [`examples/`](examples) is executed against the built package by `npm run examples` in CI: basic usage, custom calendars, Bangla locale, working days, export, HR/payroll, and a dependency-free Node.js HTTP API. The React, Next.js and Express snippets below use only the same public API. They are illustrative and are **not** run in CI.

**Node.js HTTP API** — see [`examples/node-http-server.ts`](examples/node-http-server.ts) (runs in CI).

**Express** (illustrative):

```ts
import express from "express";
import { createHolidayCalendar, HolidayDataUnavailableError, InvalidDateError } from "bangladesh-holidays";

const app = express();
const calendar = createHolidayCalendar();

app.get("/api/business-day/:date", (req, res) => {
  try {
    res.json(calendar.getDayInfo(req.params.date));
  } catch (error) {
    if (error instanceof InvalidDateError) return res.status(400).json({ error: error.message });
    if (error instanceof HolidayDataUnavailableError) return res.status(404).json({ error: error.message });
    throw error;
  }
});
```

**React** (illustrative):

```tsx
import { useMemo } from "react";
import { getUpcomingHolidays, formatDate } from "bangladesh-holidays";

export function UpcomingHolidays({ locale = "bn-BD" as const }) {
  const holidays = useMemo(() => getUpcomingHolidays(undefined, { locale, limit: 5 }), [locale]);
  return (
    <ul>
      {holidays.map((h) => (
        <li key={h.id}>
          {formatDate(h.date, locale, { weekday: true })} — {h.name}
          {h.dateStatus === "tentative" && " *"}
        </li>
      ))}
    </ul>
  );
}
```

**Next.js App Router** (illustrative, server component):

```tsx
import { getHolidays } from "bangladesh-holidays";

export default function Page() {
  const holidays = getHolidays(2027, { locale: "bn-BD" });
  return (
    <pre>
      {JSON.stringify(
        holidays.map(({ date, name }) => ({ date, name })),
        null,
        2,
      )}
    </pre>
  );
}
```

**HR / payroll** — leave counting, last-business-day payday and optional-holiday selection: [`examples/hr-payroll.ts`](examples/hr-payroll.ts).

```ts
const calendar = createHolidayCalendar({ year: 2027 });
const leaveDays = calendar.countBusinessDays("2027-03-07", "2027-03-18"); // 5
const payday = calendar.getWorkingDays(2027, 12).at(-1); // "2027-12-30"
```

**Scheduling / SLAs**:

```ts
const due = createHolidayCalendar().addBusinessDays(ticket.openedOn, 3);
```

## API reference

All dates are ISO strings (`YYYY-MM-DD`) or `Date`s, and all results are frozen. `options` is always the last argument and accepts any [`CalendarOptions`](#custom-calendars).

### Holiday queries

| Function                                                                                                                                    | Returns                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getHolidays(year, options?)` / `getHolidays(query?)`                                                                                       | `Holiday[]`, filtered by `year`, `month`, `from`/`to`, `calendar`, `category`, `type`, `dateStatus`, `community`, `dayType`, `official`, `search`; sorted by `sort` (`date`, `-date`, `name`, `-name`, `category`); paged with `offset`/`limit`. Filtering for `optional`/`observance` includes them automatically. |
| `queryHolidays(query)`                                                                                                                      | `{ items, total, offset, limit, hasMore }`                                                                                                                                                                                                                                                                          |
| `getHoliday(date, options?)`                                                                                                                | highest-precedence `Holiday` on the date, or `undefined`                                                                                                                                                                                                                                                            |
| `getHolidaysOn(date, options?)`                                                                                                             | all holidays on the date                                                                                                                                                                                                                                                                                            |
| `getHolidayById(id, options?)`                                                                                                              | `Holiday \| undefined`                                                                                                                                                                                                                                                                                              |
| `isHoliday(date, options?)`                                                                                                                 | `boolean` (full or half day)                                                                                                                                                                                                                                                                                        |
| `getHolidaysByType(year, type, options?)` · `getHolidaysByCategory(year, category, options?)` · `getHolidaysByMonth(year, month, options?)` | `Holiday[]`                                                                                                                                                                                                                                                                                                         |
| `getHolidayCount(yearOrQuery, options?)`                                                                                                    | `number`                                                                                                                                                                                                                                                                                                            |
| `getNextHoliday(date, options?)` · `getPreviousHoliday(date, options?)`                                                                     | `Holiday \| undefined` (`inclusive` option)                                                                                                                                                                                                                                                                         |
| `getUpcomingHolidays(from?, options?)`                                                                                                      | `Holiday[]` (`limit` = 5, `inclusive`, `withinDays`; `from` defaults to today in Bangladesh)                                                                                                                                                                                                                        |
| `getHolidayStatistics(year, options?)`                                                                                                      | totals, weekend overlaps, unique dates, counts by category/type/month, business days                                                                                                                                                                                                                                |
| `getCalendarSummary(year, options?)`                                                                                                        | statistics, coverage and a per-month breakdown                                                                                                                                                                                                                                                                      |

### Business days

| Function                                                                                   | Returns                                                                                                                 |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `isBusinessDay(date, options?)` · `isWorkingDay` (alias) · `isWeekend`                     | `boolean`                                                                                                               |
| `getDayInfo(date, options?)`                                                               | `{ weekday, isWeekend, holidays, observances, isHoliday, isHalfDay, isWorkingDayOverride, isBusinessDay, reason }`      |
| `addBusinessDays(date, n, options?)` · `subtractBusinessDays(date, n, options?)`           | ISO date                                                                                                                |
| `getNextBusinessDay(date, options?)` · `getPreviousBusinessDay(date, options?)`            | ISO date (strictly after/before)                                                                                        |
| `countBusinessDays(start, end, options?)` · `getBusinessDaysBetween(start, end, options?)` | `number` / `string[]` (`includeStart`, `includeEnd`, both default `true`; `start > end` throws)                         |
| `getWorkingDays(year, month?, options?)` · `getWeekendDays(year, month?, options?)`        | `string[]`                                                                                                              |
| `getLongWeekends(year, options?)`                                                          | runs of ≥ `minDays` (default 3) non-business days containing a holiday; `truncated: true` if cut at a year without data |

### `HolidayCalendar` (from `createHolidayCalendar(options)`)

Every function above is also a method, with `year` optional where the calendar has a default `year`. In addition:

- `getCoverage(year?)` · `hasDataFor(year)` · `rollToBusinessDay(date, "forward" | "backward")` · `isHalfDay(date)`
- `export(format, options?)`
- `with(options)` · `setYear` · `setLocale` · `setWeekend` · `addCustomHolidays` · `addRecurringHolidays` · `addWorkingDayOverrides` · `addExcludedDates` · `excludeHolidays` · `overrideHolidayDates` — return new calendars
- `options` (resolved, frozen) · `getConfig()` (the original input)

### Data, validation and comparison

| Function                                                                                                          | Purpose                                                                                                                                                                                                                              |
| ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `getDataset(calendar, year)` · `getAvailableYears(calendar?)` · `getDataCoverage(filter?)` · `BUILT_IN_CALENDARS` | bundled data and its availability                                                                                                                                                                                                    |
| `validateHolidayDataset(json)`                                                                                    | `{ valid, errors, warnings }`. Checks schema, real dates, ranges, dataset year, duplicate ids/holidays, sources for official data, and that official data is never `estimated`. Warns about moon-dependent dates marked `scheduled`. |
| `assertValidHolidayDataset(json)` · `normalizeDataset(json)`                                                      | throw `DatasetValidationError` / return a frozen dataset                                                                                                                                                                             |
| `getHolidayChanges(before, after)`                                                                                | `{ added, removed, changed: [{ id, changes: [{ field, before, after }] }], unchanged }`                                                                                                                                              |
| `compareHolidayCalendars(a, b, { year } \| { from, to })`                                                         | dates where business-day status or holidays differ                                                                                                                                                                                   |
| `findConflictingHolidays(holidays)` · `findConflictingHolidays(calendar, range)`                                  | dates with more than one holiday                                                                                                                                                                                                     |

### Localization, dates and export

`formatDate`, `formatNumber`, `getMonthName`, `getWeekdayName`, `getCategoryLabel`, `getTypeLabel`, `getDateStatusLabel`, `getCommunityLabel`, `toBanglaDigits`, `toLatinDigits`, `localizeHoliday`, `toBengaliDate`, `fromBengaliDate`, `formatBengaliDate`, `getBengaliMonthLengths`, `toISODate`, `isValidISODate`, `todayInBangladesh`, `isLeapYear`, `addDays`, `getWeekday`, `exportHolidays`, `exportToJson`, `exportToCsv`, `exportToIcs`.

### Errors

| Class                         | Extends      | When                                                                   |
| ----------------------------- | ------------ | ---------------------------------------------------------------------- |
| `InvalidDateError`            | `RangeError` | malformed or impossible date                                           |
| `HolidayDataUnavailableError` | `Error`      | no data for an enabled calendar/year (`.calendar`, `.year`, `.reason`) |
| `ConfigurationError`          | `TypeError`  | invalid or contradictory options                                       |
| `DatasetValidationError`      | `Error`      | invalid dataset (`.issues`)                                            |

## Dataset format and contributing data

Datasets live in [`src/data/`](src/data): one JSON file per calendar per year (`government/2027.json`), plus [`calendars.json`](src/data/calendars.json), which records which years are available or explicitly unavailable. Files follow [`schema/holiday-dataset.schema.json`](schema/holiday-dataset.schema.json), and raw JSON is also exported (`bangladesh-holidays/data/government/2027.json`).

To add a year (for example 2028 when it is announced around November 2027):

1. Get the official notification from [mopa.gov.bd](https://mopa.gov.bd) (or the Bangladesh Bank circular from [bb.org.bd](https://www.bb.org.bd)).
2. Copy `government/2027.json` to `government/2028.json`. Transcribe every row with its section, serial and printed Bangla dates, and set the dataset-level `source`, `version` and `lastUpdated`. Mark asterisked rows `"dateStatus": "tentative"`.
3. Import it in [`src/data/index.ts`](src/data/index.ts) and mark the year `available` in `calendars.json`.
4. Add a verification test like [`tests/data.test.ts`](tests/data.test.ts), checking printed weekdays, section totals, asterisks and Bangla dates.
5. Run `npm run release:check` and open a PR with a link to the source document.

Never fill gaps with estimates in an `official` dataset. If something cannot be verified, record it as unavailable. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Compatibility

- **Runtime:** the built output targets ES2020 and uses no Node.js APIs. The packaging smoke test (`npm run smoke`) installs the packed tarball and verifies ESM `import`, CommonJS `require`, TypeScript `nodenext` (ESM + CJS) and `bundler` resolution against the published declarations, and a browser bundle with no Node built-ins. It has passed on Node.js 20.20, 22.23 and 24.18, and the CI workflow runs it on Node.js 20, 22 and 24 for every push.
- **Browsers:** any modern browser via a bundler (Vite, webpack, esbuild, Next.js). About 19 kB gzipped, including the 2027 dataset.
- **TypeScript:** 5.0+ recommended; ships `.d.ts` and `.d.cts`.
- **Development** of this repository requires Node.js 22.12+ (Vitest 5).

## Data accuracy disclaimer

Holiday data is transcribed from official publications and verified by automated tests, but **the official notification is authoritative**. Moon-sighting-dependent dates (`dateStatus: "tentative"`) can change, and the government may add or move holidays during the year by separate notice. Organisations governed by their own laws, essential services, banks and educational institutions may follow different schedules. Confirm critical dates (payroll, banking, legal or statutory deadlines) against the source linked in each record. This software is provided "as is" under the MIT License, without warranty of any kind.

## Roadmap

- Bangladesh Bank 2027 holidays once the circular is published.
- Government 2026 dataset, for historical calculations.
- 2028 data when announced, plus updates for in-year changes and moon-sighting confirmations.
- Opt-in education calendars from official sources.
- A CLI for exporting calendars.

## Contributing

Contributions are welcome — especially data verification. Please read [CONTRIBUTING.md](CONTRIBUTING.md); security issues go through [SECURITY.md](SECURITY.md). This project uses [Conventional Commits](https://www.conventionalcommits.org/) and [Semantic Versioning](https://semver.org/); see [CHANGELOG.md](CHANGELOG.md).

```sh
npm install
npm run typecheck && npm run lint && npm test
npm run release:check   # everything CI runs, including build, examples and smoke test
```

## License

[MIT](LICENSE) © 2026 Md. Shamsad Alam Meraj
