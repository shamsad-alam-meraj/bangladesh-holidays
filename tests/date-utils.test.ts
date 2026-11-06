import { afterEach, describe, expect, it } from "vitest";
import {
  addDays,
  diffDays,
  eachDay,
  fromDayNumber,
  getWeekday,
  isLeapYear,
  isValidISODate,
  parseISODate,
  toDayNumber,
  toISODate,
  todayInBangladesh,
} from "../src/core/date-utils";
import { InvalidDateError, createHolidayCalendar } from "../src";

const ORIGINAL_TZ = process.env.TZ;
afterEach(() => {
  if (ORIGINAL_TZ === undefined) delete process.env.TZ;
  else process.env.TZ = ORIGINAL_TZ;
});

describe("strict ISO date parsing", () => {
  it("parses valid dates", () => {
    expect(parseISODate("2027-03-26")).toEqual({ year: 2027, month: 3, day: 26 });
    expect(parseISODate("0001-01-01")).toEqual({ year: 1, month: 1, day: 1 });
  });

  it.each([
    "2027-02-29",
    "2027-13-01",
    "2027-00-10",
    "2027-04-31",
    "2027-3-26",
    "27-03-26",
    "2027/03/26",
    "2027-03-26T00:00:00Z",
    " 2027-03-26",
    "০০০০-০১-০১",
    "0000-01-01",
    "",
  ])("rejects %j", (value) => {
    expect(() => parseISODate(value)).toThrow(InvalidDateError);
    expect(isValidISODate(value)).toBe(false);
  });

  it("rejects non-string, non-Date inputs and invalid Dates", () => {
    expect(() => toISODate(20270326 as unknown as string)).toThrow(InvalidDateError);
    expect(() => toISODate(new Date("nope"))).toThrow(InvalidDateError);
    expect(() => toISODate(null as unknown as string)).toThrow(RangeError);
    expect(isValidISODate(undefined)).toBe(false);
  });
});

describe("leap years", () => {
  it.each([
    [2024, true],
    [2027, false],
    [2028, true],
    [1900, false],
    [2000, true],
    [2100, false],
  ])("%i leap=%s", (year, leap) => {
    expect(isLeapYear(year)).toBe(leap);
    expect(isValidISODate(`${year}-02-29`)).toBe(leap);
  });

  it("does arithmetic across 29 February", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2028-02-29", 1)).toBe("2028-03-01");
    expect(addDays("2027-02-28", 1)).toBe("2027-03-01");
    expect(diffDays("2028-01-01", "2029-01-01")).toBe(366);
    expect(diffDays("2027-01-01", "2028-01-01")).toBe(365);
  });
});

describe("day-number arithmetic", () => {
  it("round-trips and crosses month/year boundaries", () => {
    for (const date of ["1970-01-01", "1969-12-31", "2027-12-31", "2000-02-29", "0099-06-15", "9999-12-31"]) {
      expect(fromDayNumber(toDayNumber(date))).toBe(date);
    }
    expect(addDays("2027-12-31", 1)).toBe("2028-01-01");
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
    expect(addDays("2027-01-31", 1)).toBe("2027-02-01");
    expect(addDays("2027-03-26", 0)).toBe("2027-03-26");
    expect(() => addDays("2027-03-26", 1.5)).toThrow(RangeError);
  });

  it("computes weekdays (0 = Sunday)", () => {
    expect(getWeekday("1970-01-01")).toBe(4);
    expect(getWeekday("2027-01-01")).toBe(5);
    expect(getWeekday("2027-03-26")).toBe(5);
    expect(getWeekday("1969-12-28")).toBe(0);
  });

  it("lists every day of a range", () => {
    expect(eachDay("2027-12-30", "2028-01-02")).toEqual([
      "2027-12-30",
      "2027-12-31",
      "2028-01-01",
      "2028-01-02",
    ]);
  });
});

describe("Date objects and time zones", () => {
  it("never mutates the caller's Date", () => {
    const date = new Date(Date.UTC(2027, 2, 25, 20, 0));
    const before = date.getTime();
    createHolidayCalendar().addBusinessDays(date, 3);
    toISODate(date);
    expect(date.getTime()).toBe(before);
  });

  it("interprets Dates in Bangladesh time by default", () => {
    // 2027-03-25T20:00Z is 02:00 on 26 March in Dhaka.
    const instant = new Date(Date.UTC(2027, 2, 25, 20, 0));
    expect(toISODate(instant)).toBe("2027-03-26");
    expect(toISODate(instant, "utc")).toBe("2027-03-25");
    expect(createHolidayCalendar().isHoliday(instant)).toBe(true);
    expect(createHolidayCalendar({ dateInterpretation: "utc" }).isHoliday(instant)).toBe(false);
  });

  it("returns today's date in Bangladesh", () => {
    expect(todayInBangladesh(new Date(Date.UTC(2026, 11, 31, 18, 30)))).toBe("2027-01-01");
    expect(todayInBangladesh(new Date(Date.UTC(2026, 11, 31, 17, 59)))).toBe("2026-12-31");
  });

  // US DST starts 14 Mar 2027 and ends 7 Nov 2027; EU DST starts 28 Mar 2027.
  const zones = [
    "UTC",
    "Asia/Dhaka",
    "America/New_York",
    "Europe/London",
    "Pacific/Kiritimati",
    "Pacific/Pago_Pago",
  ];

  it.each(zones)("string arithmetic is independent of TZ=%s", (zone) => {
    process.env.TZ = zone;
    const calendar = createHolidayCalendar({ year: 2027 });
    expect(addDays("2027-03-13", 1)).toBe("2027-03-14");
    expect(addDays("2027-03-28", 1)).toBe("2027-03-29");
    expect(addDays("2027-11-06", 2)).toBe("2027-11-08");
    expect(calendar.addBusinessDays("2027-03-11", 3)).toBe("2027-03-16");
    expect(calendar.countBusinessDays("2027-03-01", "2027-03-31")).toBe(18);
    expect(calendar.isHoliday("2027-11-07")).toBe(true);
  });

  it.each(zones)(
    "local-midnight Dates map to the local date with dateInterpretation 'local' (TZ=%s)",
    (zone) => {
      process.env.TZ = zone;
      for (const [y, m, d] of [
        [2027, 2, 14],
        [2027, 2, 28],
        [2027, 9, 31],
        [2027, 10, 7],
      ] as const) {
        const local = new Date(y, m, d);
        expect(toISODate(local, "local")).toBe(
          `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
        );
      }
    },
  );
});
