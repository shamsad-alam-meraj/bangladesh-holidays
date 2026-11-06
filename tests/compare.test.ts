import { describe, expect, it } from "vitest";
import {
  compareHolidayCalendars,
  createHolidayCalendar,
  findConflictingHolidays,
  getDataset,
  getHolidayChanges,
  getHolidays,
  type HolidayDatasetInput,
} from "../src";
import government2027 from "../src/data/government/2027.json";

describe("compareHolidayCalendars", () => {
  it("lists dates whose status differs", () => {
    const government = createHolidayCalendar();
    const christianStaff = createHolidayCalendar({
      includeOptionalHolidays: true,
      optionalHolidayCommunities: ["christian"],
    });
    const diff = compareHolidayCalendars(government, christianStaff, { year: 2027 });
    expect(diff.map((d) => d.date)).toEqual([
      "2027-01-01",
      "2027-02-10",
      "2027-03-25",
      "2027-03-26",
      "2027-03-27",
      "2027-03-28",
      "2027-12-24",
      "2027-12-26",
    ]);
    const maundy = diff.find((d) => d.date === "2027-03-25")!;
    expect(maundy.a).toEqual({ isBusinessDay: true, holidayIds: [] });
    expect(maundy.b).toEqual({ isBusinessDay: false, holidayIds: ["2027-maundy-thursday"] });
    expect(compareHolidayCalendars(government, government, { from: "2027-01-01", to: "2027-12-31" })).toEqual(
      [],
    );
    expect(() =>
      compareHolidayCalendars(government, government, { from: "2027-02-01", to: "2027-01-01" }),
    ).toThrow(RangeError);
  });
});

describe("findConflictingHolidays", () => {
  it("finds overlapping holidays in a list", () => {
    const conflicts = findConflictingHolidays(getHolidays(2027));
    expect(conflicts.map((c) => [c.date, c.holidays.map((h) => h.id)])).toEqual([
      ["2027-05-20", ["2027-buddha-purnima", "2027-eid-ul-azha-after"]],
    ]);
  });

  it("works on a calendar and range", () => {
    const calendar = createHolidayCalendar({ includeOptionalHolidays: true, region: "all" });
    const conflicts = findConflictingHolidays(calendar, { year: 2027 });
    expect(conflicts.map((c) => c.date)).toEqual(
      expect.arrayContaining(["2027-03-26", "2027-04-13", "2027-05-20", "2027-10-14"]),
    );
    expect(() => findConflictingHolidays(calendar, undefined as never)).toThrow(TypeError);
  });
});

describe("getHolidayChanges", () => {
  it("diffs dataset versions by id", () => {
    const revised = structuredClone(government2027) as HolidayDatasetInput;
    revised.version = "2027.2.0";
    revised.holidays = revised.holidays
      .filter((h) => h.id !== "2027-ashura")
      .map((h) =>
        h.id === "2027-eid-ul-fitr" ? { ...h, date: "2027-03-11", dateStatus: "confirmed" as const } : h,
      );
    revised.holidays.push({
      id: "2027-special-holiday",
      nameEn: "Special holiday",
      date: "2027-06-30",
      category: "executive-order",
      type: "other",
      dateStatus: "scheduled",
    });
    const changes = getHolidayChanges(government2027 as HolidayDatasetInput, revised);
    expect(changes.added.map((h) => h.id)).toEqual(["2027-special-holiday"]);
    expect(changes.removed.map((h) => h.id)).toEqual(["2027-ashura"]);
    expect(changes.changed).toHaveLength(1);
    expect(changes.changed[0]?.changes).toEqual([
      { field: "date", before: "2027-03-10", after: "2027-03-11" },
      { field: "dateStatus", before: "tentative", after: "confirmed" },
    ]);
    expect(changes.unchanged).toBe(government2027.holidays.length - 2);
  });

  it("accepts normalized datasets and holiday lists", () => {
    const dataset = getDataset("government", 2027)!;
    expect(getHolidayChanges(dataset, dataset).unchanged).toBe(dataset.holidays.length);
    const en = getHolidays(2027);
    const changes = getHolidayChanges(en, en.slice(1));
    expect(changes.removed.map((h) => h.id)).toEqual(["2027-shab-e-barat"]);
  });
});
