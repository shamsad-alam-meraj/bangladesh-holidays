import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as api from "../src";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
  version: string;
  sideEffects: boolean;
  dependencies?: Record<string, string>;
  exports: Record<string, unknown>;
};

describe("package metadata", () => {
  it("keeps VERSION in sync with package.json", () => {
    expect(api.VERSION).toBe(pkg.version);
  });

  it("has zero runtime dependencies and no side effects", () => {
    expect(pkg.dependencies ?? {}).toEqual({});
    expect(pkg.sideEffects).toBe(false);
  });

  it("exports the documented public API", () => {
    const documented = [
      "createHolidayCalendar",
      "HolidayCalendar",
      "getHolidays",
      "getHoliday",
      "isHoliday",
      "getHolidaysByType",
      "isBusinessDay",
      "addBusinessDays",
      "countBusinessDays",
      "getLongWeekends",
      "isWeekend",
      "isWorkingDay",
      "subtractBusinessDays",
      "getNextBusinessDay",
      "getPreviousBusinessDay",
      "getWorkingDays",
      "getBusinessDaysBetween",
      "getHolidayById",
      "getHolidaysByMonth",
      "getHolidaysByCategory",
      "getUpcomingHolidays",
      "getPreviousHoliday",
      "getNextHoliday",
      "getHolidayCount",
      "getHolidayStatistics",
      "getWeekendDays",
      "getCalendarSummary",
      "validateHolidayDataset",
      "compareHolidayCalendars",
      "findConflictingHolidays",
      "getHolidayChanges",
      "toBengaliDate",
      "formatDate",
      "exportHolidays",
    ];
    for (const name of documented) {
      expect(typeof (api as Record<string, unknown>)[name], name).toBe("function");
    }
  });
});
