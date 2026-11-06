import { describe, expect, it } from "vitest";
import {
  HolidayDataUnavailableError,
  addBusinessDays,
  countBusinessDays,
  createHolidayCalendar,
  getBusinessDaysBetween,
  getDayInfo,
  getLongWeekends,
  getNextBusinessDay,
  getPreviousBusinessDay,
  getWeekendDays,
  getWorkingDays,
  isBusinessDay,
  isWeekend,
  isWorkingDay,
  subtractBusinessDays,
} from "../src";

describe("day classification", () => {
  it("classifies weekends, holidays and business days", () => {
    expect(isWeekend("2027-03-05")).toBe(true); // Friday
    expect(isWeekend("2027-03-06")).toBe(true); // Saturday
    expect(isWeekend("2027-03-07")).toBe(false); // Sunday
    expect(isBusinessDay("2027-03-07")).toBe(false); // Shab-e-Qadr
    expect(isBusinessDay("2027-03-14")).toBe(true);
    expect(isWorkingDay("2027-03-14")).toBe(true);
    expect(isBusinessDay("2027-03-26")).toBe(false);
  });

  it("explains each day", () => {
    expect(getDayInfo("2027-03-14")).toMatchObject({
      weekday: 0,
      reason: "business-day",
      isBusinessDay: true,
    });
    expect(getDayInfo("2027-03-13")).toMatchObject({ reason: "weekend", isHoliday: false });
    expect(getDayInfo("2027-03-26")).toMatchObject({ reason: "holiday", isWeekend: true, isHoliday: true });
    expect(getDayInfo("2027-03-26").holidays.map((h) => h.id)).toEqual(["2027-independence-day"]);
  });
});

describe("addBusinessDays / subtractBusinessDays", () => {
  it("skips weekends and holidays", () => {
    expect(addBusinessDays("2027-03-04", 1)).toBe("2027-03-14"); // skips Eid-ul-Fitr block
    expect(addBusinessDays("2027-03-14", -1)).toBe("2027-03-04");
    expect(subtractBusinessDays("2027-03-14", 1)).toBe("2027-03-04");
    expect(addBusinessDays("2027-05-13", 1)).toBe("2027-05-23"); // skips Eid-ul-Azha block
    expect(addBusinessDays("2027-02-18", 1)).toBe("2027-02-22"); // skips Fri, Sat, Shaheed Day
  });

  it("handles zero and negative offsets", () => {
    expect(addBusinessDays("2027-03-14", 0)).toBe("2027-03-14");
    expect(addBusinessDays("2027-03-26", 0)).toBe("2027-03-26"); // unchanged even on a holiday
    expect(subtractBusinessDays("2027-03-14", -1)).toBe("2027-03-15");
    expect(addBusinessDays("2027-03-15", -1)).toBe("2027-03-14");
  });

  it("starting on a non-business day counts from the next business day", () => {
    expect(addBusinessDays("2027-03-26", 1)).toBe("2027-03-28");
    expect(addBusinessDays("2027-03-27", -1)).toBe("2027-03-25");
  });

  it("is consistent with countBusinessDays", () => {
    const calendar = createHolidayCalendar();
    for (const start of ["2027-01-03", "2027-03-01", "2027-05-10", "2027-10-01"]) {
      for (const n of [1, 5, 17, 40]) {
        const end = calendar.addBusinessDays(start, n);
        expect(calendar.countBusinessDays(start, end, { includeStart: false })).toBe(n);
        // Walking back lands on the last business day on or before `start`.
        const expected = calendar.rollToBusinessDay(start, "backward");
        expect(calendar.addBusinessDays(end, -n)).toBe(expected);
      }
    }
  });

  it("round-trips from business days", () => {
    const calendar = createHolidayCalendar();
    for (const start of calendar.getWorkingDays(2027, 6)) {
      expect(calendar.addBusinessDays(calendar.addBusinessDays(start, 7), -7)).toBe(start);
    }
  });

  it("rejects non-integer offsets", () => {
    expect(() => addBusinessDays("2027-03-14", 1.5)).toThrow(RangeError);
    expect(() => subtractBusinessDays("2027-03-14", Number.NaN)).toThrow(RangeError);
  });

  it("throws when crossing into a year without data", () => {
    expect(() => addBusinessDays("2027-12-28", 5)).toThrow(HolidayDataUnavailableError);
    expect(() => addBusinessDays("2027-01-03", -2)).toThrow(HolidayDataUnavailableError);
  });

  it("crosses year boundaries when data policy allows", () => {
    const calendar = createHolidayCalendar({ onMissingData: "ignore" });
    // Thu 30 Dec 2027 + 1 → skip Fri 31, Sat 1 Jan → Sun 2 Jan 2028.
    expect(calendar.addBusinessDays("2027-12-30", 1)).toBe("2028-01-02");
    expect(calendar.addBusinessDays("2028-01-02", -1)).toBe("2027-12-30");
  });

  it("guards against calendars with no business days", () => {
    const calendar = createHolidayCalendar({
      customHolidays: [{ date: "2027-01-01", endDate: "2027-12-31", name: "Closed all year" }],
    });
    expect(() => calendar.addBusinessDays("2027-06-01", 1)).toThrow(HolidayDataUnavailableError);
    const ignore = calendar.with({ onMissingData: "ignore", weekend: [0, 1, 2, 3, 4, 5] });
    expect(ignore.addBusinessDays("2027-06-01", 1)).toBe("2028-01-01");
  });
});

describe("next / previous / roll", () => {
  it("finds neighbouring business days", () => {
    expect(getNextBusinessDay("2027-12-15")).toBe("2027-12-19");
    expect(getPreviousBusinessDay("2027-12-19")).toBe("2027-12-15");
    const calendar = createHolidayCalendar();
    expect(calendar.rollToBusinessDay("2027-12-16")).toBe("2027-12-19");
    expect(calendar.rollToBusinessDay("2027-12-16", "backward")).toBe("2027-12-15");
    expect(calendar.rollToBusinessDay("2027-12-15")).toBe("2027-12-15");
  });
});

describe("counting and listing business days", () => {
  it("counts inclusively by default and honours range options", () => {
    expect(countBusinessDays("2027-03-01", "2027-03-31")).toBe(18);
    expect(countBusinessDays("2027-03-14", "2027-03-18")).toBe(5);
    expect(countBusinessDays("2027-03-14", "2027-03-18", { includeStart: false })).toBe(4);
    expect(countBusinessDays("2027-03-14", "2027-03-18", { includeEnd: false })).toBe(4);
    expect(countBusinessDays("2027-03-14", "2027-03-18", { includeStart: false, includeEnd: false })).toBe(3);
    expect(countBusinessDays("2027-03-14", "2027-03-14")).toBe(1);
    expect(countBusinessDays("2027-03-14", "2027-03-14", { includeEnd: false })).toBe(0);
    expect(countBusinessDays("2027-03-26", "2027-03-26")).toBe(0);
  });

  it("rejects reversed ranges", () => {
    expect(() => countBusinessDays("2027-03-18", "2027-03-14")).toThrow(RangeError);
  });

  it("lists the business days", () => {
    expect(getBusinessDaysBetween("2027-03-03", "2027-03-16")).toEqual([
      "2027-03-03",
      "2027-03-04",
      "2027-03-14",
      "2027-03-15",
      "2027-03-16",
    ]);
  });

  it("respects working-day overrides and custom holidays", () => {
    const options = {
      workingDayOverrides: ["2027-03-13"],
      customHolidays: [{ date: "2027-03-15", name: "Office closed" }],
    };
    expect(countBusinessDays("2027-03-13", "2027-03-16", options)).toBe(3);
    expect(getBusinessDaysBetween("2027-03-13", "2027-03-16", options)).toEqual([
      "2027-03-13",
      "2027-03-14",
      "2027-03-16",
    ]);
  });

  it("counts working and weekend days per month", () => {
    expect(getWorkingDays(2027, 3)).toHaveLength(18);
    expect(getWeekendDays(2027, 3)).toHaveLength(8);
    expect(getWorkingDays(2027)).toHaveLength(240); // national scope: 13 Apr (hill districts only) is a working day
    expect(getWeekendDays(2027)).toHaveLength(105);
    expect(getWorkingDays(2027, 2, { weekend: [5] })).toHaveLength(23);
    expect(getWeekendDays(2027, { weekend: [0] })).toHaveLength(52);
    expect(() => getWorkingDays(2027, 0)).toThrow(RangeError);
  });

  it("handles leap-year February", () => {
    const calendar = createHolidayCalendar({ onMissingData: "ignore" });
    expect(calendar.getWeekendDays(2028, 2)).toHaveLength(8);
    expect(calendar.getWorkingDays(2028, 2)).toHaveLength(21);
    expect(calendar.getWorkingDays(2028, 2)).toContain("2028-02-29");
    expect(calendar.countBusinessDays("2028-02-27", "2028-03-01")).toBe(4);
  });
});

describe("long weekends", () => {
  it("finds runs of 3+ non-business days containing a holiday", () => {
    const runs = getLongWeekends(2027);
    expect(runs.map((run) => [run.startDate, run.endDate, run.days])).toEqual([
      ["2027-01-22", "2027-01-24", 3],
      ["2027-02-19", "2027-02-21", 3],
      ["2027-03-05", "2027-03-13", 9],
      ["2027-05-14", "2027-05-22", 9],
      ["2027-08-05", "2027-08-07", 3],
      ["2027-08-13", "2027-08-15", 3],
      ["2027-10-08", "2027-10-10", 3],
      ["2027-11-05", "2027-11-07", 3],
      ["2027-12-16", "2027-12-18", 3],
    ]);
    expect(runs[2]?.holidays.map((h) => h.id)).toEqual([
      "2027-jumatul-bida",
      "2027-shab-e-qadr",
      "2027-eid-ul-fitr-before",
      "2027-eid-ul-fitr",
      "2027-eid-ul-fitr-after",
    ]);
    expect(runs.every((run) => !run.truncated)).toBe(true);
  });

  it("supports minDays and other weekends", () => {
    expect(getLongWeekends(2027, { minDays: 5 })).toHaveLength(2);
    expect(getLongWeekends(2027, { weekend: [5], minDays: 2 }).length).toBeGreaterThan(5);
    expect(() => getLongWeekends(2027, { minDays: 0 })).toThrow(RangeError);
  });

  it("marks runs cut at a year without data as truncated", () => {
    const calendar = createHolidayCalendar({
      customHolidays: [{ date: "2027-12-30", name: "Year-end closure" }],
    });
    // Only 30–31 Dec are known (2 days), so it does not meet the default minDays of 3.
    expect(calendar.getLongWeekends(2027).slice(-1)[0]?.startDate).toBe("2027-12-16");
    expect(calendar.getLongWeekends(2027, { minDays: 2 }).slice(-1)[0]).toMatchObject({
      startDate: "2027-12-30",
      endDate: "2027-12-31",
      days: 2,
      truncated: true,
    });
  });

  it("extends runs across years when data is available", () => {
    const calendar = createHolidayCalendar({
      onMissingData: "ignore",
      customHolidays: [{ date: "2027-12-30", name: "Year-end closure" }],
    });
    const last = calendar.getLongWeekends(2027).slice(-1)[0];
    expect(last).toMatchObject({ startDate: "2027-12-30", endDate: "2028-01-01", days: 3, truncated: false });
    expect(calendar.getLongWeekends(2028)[0]).toMatchObject({
      startDate: "2027-12-30",
      endDate: "2028-01-01",
    });
  });
});
