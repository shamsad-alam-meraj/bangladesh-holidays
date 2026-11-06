import { describe, expect, it } from "vitest";
import {
  HolidayDataUnavailableError,
  InvalidDateError,
  getAvailableYears,
  getCalendarSummary,
  getDataCoverage,
  getHoliday,
  getHolidayById,
  getHolidayCount,
  getHolidayStatistics,
  getHolidays,
  getHolidaysByCategory,
  getHolidaysByMonth,
  getHolidaysByType,
  getHolidaysOn,
  getNextHoliday,
  getPreviousHoliday,
  getUpcomingHolidays,
  isHoliday,
  queryHolidays,
} from "../src";

describe("getHolidays", () => {
  it("lists the default calendar: general + executive-order, national scope", () => {
    const holidays = getHolidays(2027);
    // 15 general records minus regional Chaitra Sankranti, plus 9 executive-order records.
    expect(holidays).toHaveLength(23);
    expect(new Set(holidays.map((h) => h.category))).toEqual(new Set(["general", "executive-order"]));
    expect(holidays.some((h) => h.id === "2027-chaitra-sankranti")).toBe(false);
    const dates = holidays.map((h) => h.date);
    expect([...dates].sort()).toEqual(dates);
  });

  it("includes regional holidays for a matching region or 'all'", () => {
    expect(getHolidays(2027, { region: "rangamati" })).toHaveLength(24);
    expect(getHolidays(2027, { region: "all" })).toHaveLength(24);
    expect(getHolidays(2027, { region: "Bandarban " }).some((h) => h.id === "2027-chaitra-sankranti")).toBe(
      true,
    );
    expect(getHolidays(2027, { region: "dhaka" })).toHaveLength(23);
  });

  it("accepts a query object with month, calendar and locale", () => {
    const march = getHolidays({ year: 2027, month: 3, calendar: "government", locale: "en" });
    expect(march.map((h) => h.id)).toEqual([
      "2027-jumatul-bida",
      "2027-shab-e-qadr",
      "2027-eid-ul-fitr-before",
      "2027-eid-ul-fitr",
      "2027-eid-ul-fitr-after",
      "2027-independence-day",
    ]);
    expect(getHolidays({ year: 2027, month: 3, locale: "bn-BD" })[0]?.name).toBe("জুমাতুল বিদা");
  });

  it("filters by date range, including holidays that overlap it", () => {
    const range = getHolidays({ from: "2027-03-09", to: "2027-03-11" });
    expect(range.map((h) => h.id)).toEqual([
      "2027-eid-ul-fitr-before",
      "2027-eid-ul-fitr",
      "2027-eid-ul-fitr-after",
    ]);
    expect(getHolidays({ from: "2027-12-20" }).map((h) => h.id)).toEqual(["2027-christmas-day"]);
    expect(() => getHolidays({ from: "2027-05-01", to: "2027-04-01" })).toThrow(RangeError);
  });

  it("filters by type, status, search and official flag", () => {
    expect(getHolidaysByType(2027, "national").map((h) => h.id)).toEqual([
      "2027-shaheed-day",
      "2027-independence-day",
      "2027-may-day",
      "2027-july-uprising-day",
      "2027-national-revolution-solidarity-day",
      "2027-victory-day",
    ]);
    expect(getHolidays(2027, { type: ["cultural"] }).map((h) => h.id)).toEqual(["2027-bengali-new-year"]);
    expect(getHolidays(2027, { dateStatus: "tentative" })).toHaveLength(11);
    expect(getHolidays(2027, { search: "EID" }).length).toBe(7);
    expect(getHolidays(2027, { search: "ঈদ-উল-আজহা" }).length).toBe(3);
    expect(getHolidays(2027, { official: false })).toEqual([]);
  });

  it("auto-includes optional holidays when that category is requested", () => {
    const optional = getHolidaysByCategory(2027, "optional");
    expect(optional).toHaveLength(31);
    expect(getHolidays(2027, { category: "optional", community: "hindu" })).toHaveLength(8);
    expect(getHolidays(2027, { category: "optional", community: "christian" }).map((h) => h.date)).toContain(
      "2027-03-28",
    );
    expect(getHolidaysByCategory(2027, ["general"])).toHaveLength(14);
  });

  it("supports sorting and pagination", () => {
    const page = queryHolidays({ year: 2027, limit: 5, offset: 20 });
    expect(page.total).toBe(23);
    expect(page.items).toHaveLength(3);
    expect(page.hasMore).toBe(false);
    expect(queryHolidays({ year: 2027, limit: 5 }).hasMore).toBe(true);
    expect(getHolidays(2027, { sort: "-date" })[0]?.id).toBe("2027-christmas-day");
    const byName = getHolidays(2027, { sort: "name" }).map((h) => h.name);
    expect(byName).toEqual([...byName].sort((a, b) => a.localeCompare(b)));
    expect(getHolidays(2027, { sort: "category" })[0]?.category).toBe("general");
    expect(() => queryHolidays({ year: 2027, offset: -1 })).toThrow(RangeError);
    expect(() => queryHolidays({ year: 2027, limit: 1.5 })).toThrow(RangeError);
  });

  it("returns immutable results", () => {
    const holidays = getHolidays(2027);
    expect(Object.isFrozen(holidays)).toBe(true);
    expect(Object.isFrozen(holidays[0])).toBe(true);
    expect(() => {
      (holidays[0] as { name: string }).name = "x";
    }).toThrow(TypeError);
    expect(getHolidays(2027)[0]?.name).toBe("Shab-e-Barat");
  });

  it("validates arguments", () => {
    expect(() => getHolidays(2027.5)).toThrow(RangeError);
    expect(() => getHolidays({ year: 2027, month: 13 })).toThrow(RangeError);
  });

  it("refuses to answer for years without data instead of returning nothing", () => {
    expect(() => getHolidays(2026)).toThrow(HolidayDataUnavailableError);
    expect(() => getHolidays(2028)).toThrow(/No government holiday data is available for 2028/);
    expect(getHolidays(2028, { onMissingData: "ignore" })).toEqual([]);
  });
});

describe("single-date lookups", () => {
  it("getHoliday returns the localized record", () => {
    const holiday = getHoliday("2027-03-26", { locale: "bn-BD" });
    expect(holiday).toMatchObject({
      name: "স্বাধীনতা ও জাতীয় দিবস",
      date: "2027-03-26",
      category: "general",
    });
    expect(holiday?.nameEn).toBe("Independence and National Day");
    expect(getHoliday("2027-03-26")?.name).toBe("Independence and National Day");
    expect(getHoliday("2027-03-25")).toBeUndefined();
  });

  it("isHoliday covers every day of multi-day holidays", () => {
    for (const date of ["2027-05-15", "2027-05-16", "2027-05-17", "2027-05-18", "2027-05-19", "2027-05-20"]) {
      expect(isHoliday(date)).toBe(true);
    }
    expect(isHoliday("2027-05-21")).toBe(false);
    expect(isHoliday("2027-05-21", { includeOptionalHolidays: true })).toBe(true);
  });

  it("returns overlapping holidays in precedence order", () => {
    expect(getHolidaysOn("2027-05-20").map((h) => h.id)).toEqual([
      "2027-buddha-purnima",
      "2027-eid-ul-azha-after",
    ]);
    expect(getHoliday("2027-05-20")?.id).toBe("2027-buddha-purnima");
  });

  it("rejects invalid dates", () => {
    expect(() => isHoliday("2027-02-29")).toThrow(InvalidDateError);
    expect(() => getHoliday("26-03-2027")).toThrow(InvalidDateError);
  });

  it("finds holidays by id", () => {
    expect(getHolidayById("2027-victory-day")?.date).toBe("2027-12-16");
    expect(getHolidayById("2027-good-friday")).toBeUndefined();
    expect(getHolidayById("2027-good-friday", { includeOptionalHolidays: true })?.date).toBe("2027-03-26");
    expect(getHolidayById("does-not-exist")).toBeUndefined();
  });
});

describe("next / previous / upcoming", () => {
  it("finds the next and previous holiday", () => {
    expect(getNextHoliday("2027-03-26")?.id).toBe("2027-bengali-new-year");
    expect(getNextHoliday("2027-03-26", { inclusive: true })?.id).toBe("2027-independence-day");
    expect(getPreviousHoliday("2027-03-26")?.id).toBe("2027-eid-ul-fitr-after");
    expect(getPreviousHoliday("2027-03-26", { inclusive: true })?.id).toBe("2027-independence-day");
  });

  it("throws at the edge of available data rather than guessing", () => {
    expect(() => getNextHoliday("2027-12-26")).toThrow(HolidayDataUnavailableError);
    expect(() => getPreviousHoliday("2027-01-10")).toThrow(HolidayDataUnavailableError);
    expect(getNextHoliday("2027-12-26", { onMissingData: "ignore" })).toBeUndefined();
    expect(getPreviousHoliday("2027-01-10", { onMissingData: "ignore" })).toBeUndefined();
  });

  it("lists upcoming holidays with limit and window", () => {
    expect(getUpcomingHolidays("2027-08-01", { limit: 3 }).map((h) => h.id)).toEqual([
      "2027-july-uprising-day",
      "2027-eid-e-miladunnabi",
      "2027-janmashtami",
    ]);
    expect(getUpcomingHolidays("2027-08-05", { inclusive: false, limit: 1 })[0]?.id).toBe(
      "2027-eid-e-miladunnabi",
    );
    expect(getUpcomingHolidays("2027-08-01", { withinDays: 14 })).toHaveLength(2);
    expect(getUpcomingHolidays("2027-12-01", { limit: 0 })).toEqual([]);
    expect(getUpcomingHolidays("2027-12-20", { withinDays: 7 }).map((h) => h.id)).toEqual([
      "2027-christmas-day",
    ]);
  });
});

describe("counts, statistics and summaries", () => {
  it("reproduces the official totals", () => {
    const stats = getHolidayStatistics(2027, { region: "all" });
    expect(stats.byCategory.general).toEqual({ holidays: 15, days: 15, weekendDays: 4 });
    expect(stats.byCategory["executive-order"]).toEqual({ holidays: 9, days: 14, weekendDays: 3 });
    expect(stats.totalHolidayDays).toBe(29);
    expect(stats.holidayDaysOnWeekends).toBe(7);
    // The notice's "22 effective days" counts 20 May twice (Buddha Purnima + Eid-ul-Azha).
    expect(stats.uniqueHolidayDates).toBe(28);
    expect(stats.uniqueNonWeekendHolidayDates).toBe(21);
    expect(stats.tentativeHolidays).toBe(11);
    expect(stats.byMonth.reduce((a, b) => a + b, 0)).toBe(28);
    expect(stats.calendarDays).toBe(365);
    expect(stats.weekendDays).toBe(105); // 2027 starts on a Friday: 53 Fridays
    expect(stats.businessDays).toBe(365 - 105 - 21);
  });

  it("counts holidays", () => {
    expect(getHolidayCount(2027)).toBe(23);
    expect(getHolidayCount({ year: 2027, category: "executive-order" })).toBe(9);
    expect(getHolidaysByMonth(2027, 5).map((h) => h.date)).toEqual([
      "2027-05-01",
      "2027-05-15",
      "2027-05-17",
      "2027-05-18",
      "2027-05-20",
    ]);
  });

  it("summarizes a year by month", () => {
    const summary = getCalendarSummary(2027, { locale: "bn" });
    expect(summary.months).toHaveLength(12);
    expect(summary.months.reduce((sum, m) => sum + m.businessDays, 0)).toBe(summary.statistics.businessDays);
    expect(summary.months[2]?.holidayDates).toBe(8);
    expect(summary.coverage).toEqual([
      expect.objectContaining({ calendar: "government", status: "available" }),
    ]);
    expect(summary.locale).toBe("bn");
  });
});

describe("data coverage", () => {
  it("lists available years and explicitly unavailable calendars", () => {
    expect(getAvailableYears()).toEqual([2027]);
    expect(getAvailableYears("bank")).toEqual([]);
    const bank = getDataCoverage({ calendar: "bank", year: 2027 })[0];
    expect(bank?.status).toBe("unavailable");
    expect(bank?.reason).toMatch(/Bangladesh Bank had not published/);
    expect(getDataCoverage({ calendar: "government" })[0]).toMatchObject({
      status: "available",
      datasetVersion: "2027.1.0",
    });
    expect(getDataCoverage().length).toBeGreaterThanOrEqual(3);
  });
});
