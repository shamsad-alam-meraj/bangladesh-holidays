# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/). Dataset versions (e.g. `2027.1.0`)
are tracked separately inside each data file and listed under **Data** below.

## [Unreleased]

## [1.0.0] - 2026-11-06

### Added

- `createHolidayCalendar()` / `HolidayCalendar`: immutable, configurable calendars with custom
  weekends, multiple calendar sources, custom, recurring and date-range holidays, half days,
  substitute holidays, excluded dates and ids, working-day overrides, moon-sighting date overrides,
  regional scope, per-community optional holidays, observances, documented precedence rules and
  conflict detection.
- Holiday queries: `getHolidays`, `queryHolidays` (pagination), `getHoliday`, `getHolidaysOn`,
  `getHolidayById`, `isHoliday`, `getHolidaysByType`, `getHolidaysByCategory`, `getHolidaysByMonth`,
  `getHolidayCount`, `getNextHoliday`, `getPreviousHoliday`, `getUpcomingHolidays`,
  `getHolidayStatistics`, `getCalendarSummary`.
- Business days: `isBusinessDay`, `isWorkingDay`, `isWeekend`, `getDayInfo`, `addBusinessDays`,
  `subtractBusinessDays`, `getNextBusinessDay`, `getPreviousBusinessDay`, `countBusinessDays`,
  `getBusinessDaysBetween`, `getWorkingDays`, `getWeekendDays`, `getLongWeekends`,
  `rollToBusinessDay`.
- Explicit data coverage (`getDataCoverage`, `HolidayDataUnavailableError`, `onMissingData`).
- Dataset validation (`validateHolidayDataset`, JSON Schema), `getHolidayChanges`,
  `compareHolidayCalendars`, `findConflictingHolidays`.
- Localization for `en`, `en-BD`, `bn` and `bn-BD`: Bangla names and descriptions, Bangla
  numerals, notice-style date formatting and a revised Bangla calendar converter (1426 BS onward).
- JSON, RFC 4180 CSV and RFC 5545 ICS export with reminders.
- ESM and CommonJS builds with TypeScript declarations; zero runtime dependencies.

### Data

- `government/2027.json` **2027.1.0**: all general, executive-order and optional holidays
  transcribed from MoPA notification 05.00.0000.175.08.0008.25-105 (05 November 2026).
- Bangladesh Bank 2027: recorded as unavailable (not published as of 2026-11-06).

[Unreleased]: https://github.com/shamsad-alam-meraj/bangladesh-holidays/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/shamsad-alam-meraj/bangladesh-holidays/releases/tag/v1.0.0
