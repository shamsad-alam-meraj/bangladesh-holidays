import { describe, expect, it } from "vitest";
import {
  BENGALI_SEASONS_BN,
  createHolidayCalendar,
  formatBengaliDate,
  getMonthCalendar,
  suggestLeave,
  toBengaliDate,
} from "../src";

describe("suggestLeave (leave planner)", () => {
  const calendar = createHolidayCalendar({ year: 2027 });

  it("finds the best single leave days around Eid", () => {
    const plans = suggestLeave(2027);
    expect(plans[0]).toMatchObject({
      leaveDates: ["2027-03-04"],
      startDate: "2027-03-04",
      endDate: "2027-03-13",
      daysOff: 10,
      leaveDays: 1,
      efficiency: 10,
      truncated: false,
    });
    expect(plans[1]).toMatchObject({
      leaveDates: ["2027-05-13"],
      startDate: "2027-05-13",
      endDate: "2027-05-22",
      daysOff: 10,
    });
    expect(plans[0]?.holidays.map((h) => h.id)).toContain("2027-eid-ul-fitr");
  });

  it("returns valid, non-overlapping, ranked plans", () => {
    const plans = calendar.suggestLeave(2027, { maxLeaveDays: 3, limit: 20 });
    expect(plans.length).toBeGreaterThan(5);
    for (const plan of plans) {
      expect(plan.leaveDays).toBeLessThanOrEqual(3);
      expect(plan.leaveDates).toHaveLength(plan.leaveDays);
      expect(plan.daysOff).toBeGreaterThanOrEqual(4);
      expect(plan.daysOff).toBeGreaterThan(plan.leaveDays);
      expect(plan.efficiency).toBeCloseTo(plan.daysOff / plan.leaveDays);
      expect(plan.holidays.length).toBeGreaterThan(0);
      for (const date of plan.leaveDates) {
        expect(calendar.isBusinessDay(date)).toBe(true);
        expect(date >= plan.startDate && date <= plan.endDate).toBe(true);
      }
      // Every other day in the break is already a day off.
      expect(calendar.countBusinessDays(plan.startDate, plan.endDate)).toBe(plan.leaveDays);
    }
    for (let i = 1; i < plans.length; i++)
      expect(plans[i - 1]!.efficiency).toBeGreaterThanOrEqual(plans[i]!.efficiency);
    for (const a of plans) {
      for (const b of plans) {
        if (a !== b) expect(a.startDate > b.endDate || a.endDate < b.startDate).toBe(true);
      }
    }
    expect(Object.isFrozen(plans)).toBe(true);
  });

  it("can return overlapping alternatives", () => {
    const all = calendar.suggestLeave(2027, { allowOverlap: true, limit: 100 });
    expect(
      all.some((plan) => plan.leaveDates.join() === "2027-03-14" && plan.startDate === "2027-03-05"),
    ).toBe(true);
    expect(
      all.some((plan) => plan.leaveDates.join() === "2027-05-13,2027-05-23" && plan.daysOff === 11),
    ).toBe(true);
  });

  it("respects requireHoliday, minDaysOff and year boundaries", () => {
    const strict = calendar.suggestLeave(2027, {
      requireHoliday: false,
      minDaysOff: 2,
      maxLeaveDays: 1,
      limit: 400,
    });
    const yearEnd = strict.find((plan) => plan.leaveDates.join() === "2027-12-30");
    expect(yearEnd).toMatchObject({
      startDate: "2027-12-30",
      endDate: "2027-12-31",
      daysOff: 2,
      truncated: true,
    });
    const lenient = createHolidayCalendar({ onMissingData: "ignore" }).suggestLeave(2027, {
      requireHoliday: false,
      minDaysOff: 3,
      maxLeaveDays: 1,
      limit: 400,
    });
    expect(lenient.find((plan) => plan.leaveDates.join() === "2027-12-30")).toMatchObject({
      endDate: "2028-01-01",
      daysOff: 3,
      truncated: false,
    });
    expect(calendar.suggestLeave(2027, { limit: 0 })).toEqual([]);
  });

  it("validates options", () => {
    expect(() => calendar.suggestLeave(2027, { maxLeaveDays: 0 })).toThrow(RangeError);
    expect(() => calendar.suggestLeave(2027, { maxLeaveDays: 31 })).toThrow(RangeError);
    expect(() => calendar.suggestLeave(2027, { minDaysOff: 0 })).toThrow(RangeError);
    expect(() => calendar.suggestLeave(2027, { limit: -1 })).toThrow(RangeError);
    expect(() => suggestLeave(2026)).toThrow(/2026/);
  });
});

describe("getMonthCalendar", () => {
  it("builds a Sunday-first grid for March 2027", () => {
    const march = getMonthCalendar(2027, 3);
    expect(march.monthName).toBe("March");
    expect(march.weekdays.map((d) => d.name.slice(0, 3))).toEqual([
      "Sun",
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
      "Sat",
    ]);
    expect(march.weeks).toHaveLength(5);
    expect(march.weeks.every((week) => week.length === 7)).toBe(true);
    const first = march.weeks[0]![0]!;
    expect(first).toMatchObject({
      date: "2027-02-28",
      inMonth: false,
      isBusinessDay: null,
      isHoliday: false,
    });
    const inMonth = march.weeks.flat().filter((day) => day.inMonth);
    expect(inMonth).toHaveLength(31);
    expect(inMonth.find((d) => d.date === "2027-03-10")).toMatchObject({
      isHoliday: true,
      isBusinessDay: false,
    });
    expect(inMonth.find((d) => d.date === "2027-03-14")).toMatchObject({
      isHoliday: false,
      isBusinessDay: true,
    });
    expect(march.businessDays).toBe(18);
    expect(march.holidays).toHaveLength(6);
    expect(inMonth.find((d) => d.date === "2027-03-26")?.bengaliDate).toBe("12 Choitro 1433");
  });

  it("supports week start, Bangla, fixed rows and no Bangla dates", () => {
    const grid = getMonthCalendar(2027, 3, { locale: "bn", weekStartsOn: 6, fixedWeeks: true });
    expect(grid.weekdays[0]).toMatchObject({ weekday: 6, name: "শনিবার", isWeekend: true });
    expect(grid.weeks[0]![0]!.date).toBe("2027-02-27");
    expect(grid.weeks).toHaveLength(6);
    expect(grid.monthName).toBe("মার্চ");
    expect(grid.weeks[0]![0]!.bengaliDate).toBe("১৪ ফাল্গুন ১৪৩৩");
    const plain = getMonthCalendar(2027, 3, { bengaliDates: false });
    expect(plain.weeks.flat().every((day) => day.bengaliDate === undefined)).toBe(true);
  });

  it("does not need data for days outside the month", () => {
    const december = getMonthCalendar(2027, 12);
    const last = december.weeks[december.weeks.length - 1]!;
    expect(last.some((day) => day.date.startsWith("2028-"))).toBe(true);
    expect(last.filter((day) => !day.inMonth).every((day) => day.isBusinessDay === null)).toBe(true);
  });

  it("omits Bangla dates before the revised calendar and validates input", () => {
    const old = getMonthCalendar(2019, 4, { onMissingData: "ignore" });
    expect(old.weeks.flat().find((d) => d.date === "2019-04-13")?.bengaliDate).toBeUndefined();
    expect(old.weeks.flat().find((d) => d.date === "2019-04-14")?.bengaliDate).toBe(
      "1 Boishakh 1426".replace("1 ", "01 "),
    );
    expect(() => getMonthCalendar(2027, 13)).toThrow(RangeError);
    expect(() => getMonthCalendar(2027, 3, { weekStartsOn: 7 as never })).toThrow(RangeError);
  });
});

describe("Bangla seasons and weekdays", () => {
  it.each([
    ["2027-04-14", 1, "গ্রীষ্ম", "Grishma"],
    ["2027-08-05", 2, "বর্ষা", "Borsha"],
    ["2027-10-10", 3, "শরৎ", "Shorot"],
    ["2027-11-07", 4, "হেমন্ত", "Hemonto"],
    ["2027-12-16", 5, "শীত", "Sheet"],
    ["2027-03-26", 6, "বসন্ত", "Boshonto"],
  ])("%s is in season %i (%s)", (date, season, bn, en) => {
    expect(toBengaliDate(date)).toMatchObject({ season, seasonBn: bn, seasonEn: en });
  });

  it("adds weekday names and formats with season", () => {
    expect(toBengaliDate("2027-03-26")).toMatchObject({
      weekday: 5,
      weekdayBn: "শুক্রবার",
      weekdayEn: "Friday",
    });
    expect(formatBengaliDate("2027-03-26", { weekday: true, season: true })).toBe(
      "শুক্রবার, ১২ চৈত্র ১৪৩৩ (বসন্তকাল)",
    );
    expect(formatBengaliDate("2027-08-05", { locale: "en", weekday: true, season: true })).toBe(
      "Thursday, 21 Srabon 1434 (Borsha)",
    );
    expect(BENGALI_SEASONS_BN).toHaveLength(6);
  });
});

describe("ICS feed options", () => {
  const calendar = createHolidayCalendar({ year: 2027 });
  const timestamp = new Date(Date.UTC(2026, 10, 6));

  it("adds refresh interval and description for subscriptions", () => {
    const ics = calendar.export("ics", {
      timestamp,
      refreshIntervalHours: 24,
      calendarDescription: "Holidays, BD",
    });
    expect(ics).toContain("REFRESH-INTERVAL;VALUE=DURATION:PT24H\r\n");
    expect(ics).toContain("X-PUBLISHED-TTL:PT24H\r\n");
    expect(ics).toContain("X-WR-CALDESC:Holidays\\, BD\r\n");
    expect(calendar.export("ics", { timestamp })).not.toContain("REFRESH-INTERVAL");
    expect(() => calendar.export("ics", { refreshIntervalHours: 0 })).toThrow(RangeError);
    expect(() => calendar.export("ics", { refreshIntervalHours: 1.5 })).toThrow(RangeError);
  });
});
