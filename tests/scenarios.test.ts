/**
 * Realistic usage scenarios exercising the public API end to end.
 */
import { describe, expect, it } from "vitest";
import {
  HolidayDataUnavailableError,
  createHolidayCalendar,
  formatDate,
  getHolidays,
  getUpcomingHolidays,
  isBusinessDay,
  toBanglaDigits,
} from "../src";

describe("payroll: salary disbursement date", () => {
  /** Pay on the last business day of the month. */
  function payday(year: number, month: number): string {
    const calendar = createHolidayCalendar();
    const days = calendar.getWorkingDays(year, month);
    return days[days.length - 1]!;
  }

  it("moves payday before holidays and weekends", () => {
    expect(payday(2027, 3)).toBe("2027-03-31");
    expect(payday(2027, 7)).toBe("2027-07-29"); // 30 Jul Fri, 31 Jul Sat
    expect(payday(2027, 12)).toBe("2027-12-30"); // 31 Dec is a Friday
  });
});

describe("HR: leave application", () => {
  const calendar = createHolidayCalendar({ year: 2027 });

  it("counts leave days excluding weekends and public holidays", () => {
    // Employee applies for 7 March – 18 March 2027 (Eid-ul-Fitr period).
    expect(calendar.countBusinessDays("2027-03-07", "2027-03-18")).toBe(5);
    expect(calendar.getBusinessDaysBetween("2027-03-07", "2027-03-18")).toEqual([
      "2027-03-14",
      "2027-03-15",
      "2027-03-16",
      "2027-03-17",
      "2027-03-18",
    ]);
  });

  it("supports a Hindu employee's optional holidays (max three chosen)", () => {
    const chosen = ["2027-durga-puja-saptami-ashtami", "2027-lakshmi-puja"];
    const all = calendar.with({ includeOptionalHolidays: true, optionalHolidayCommunities: ["hindu"] });
    const notChosen = all
      .getHolidays({ category: "optional" })
      .map((h) => h.id)
      .filter((id) => !chosen.includes(id));
    const employee = all.excludeHolidays(...notChosen);
    const optionalDays = employee
      .getHolidays({ category: "optional" })
      .reduce((sum, holiday) => sum + holiday.durationDays, 0);
    expect(optionalDays).toBe(3);
    expect(employee.isBusinessDay("2027-10-07")).toBe(false);
    expect(employee.isBusinessDay("2027-10-28")).toBe(true); // Shyama Puja not chosen
  });
});

describe("SLA: support ticket due dates", () => {
  it("adds business days for a 3-business-day SLA over Eid-ul-Azha", () => {
    const opened = "2027-05-13";
    expect(createHolidayCalendar().addBusinessDays(opened, 3)).toBe("2027-05-25");
  });

  it("uses a six-day work week for a factory", () => {
    const factory = createHolidayCalendar({ weekend: [5] });
    expect(factory.addBusinessDays("2027-05-13", 3)).toBe("2027-05-24");
  });
});

describe("bank operations without Bangladesh Bank data", () => {
  it("fails loudly instead of assuming government holidays apply to banks", () => {
    expect(() => isBusinessDay("2027-06-30", { calendars: ["bank"] })).toThrow(HolidayDataUnavailableError);
  });

  it("can load a bank calendar supplied by the application", () => {
    const bank = createHolidayCalendar({
      calendars: ["government", "bank"],
      datasets: [
        {
          schemaVersion: 1,
          calendar: "bank",
          year: 2027,
          version: "2027.0.1",
          status: "custom",
          lastUpdated: "2026-11-06",
          holidays: [
            {
              id: "my-bank-2027-07-01",
              nameEn: "Bank holiday (application-supplied)",
              date: "2027-07-01",
              category: "bank",
              type: "bank",
              dateStatus: "scheduled",
            },
          ],
        },
      ],
    });
    expect(bank.isBusinessDay("2027-07-01")).toBe(false);
    expect(bank.getHoliday("2027-07-01")?.official).toBe(false);
  });
});

describe("moon sighting update workflow", () => {
  it("applies the moon-sighting committee's decision", () => {
    const before = createHolidayCalendar({ year: 2027 });
    expect(before.getHoliday("2027-03-10")?.dateStatus).toBe("tentative");
    // Suppose Eid-ul-Fitr is announced for 11 March: the government re-issues the schedule.
    const after = before.overrideHolidayDates(
      { id: "2027-eid-ul-fitr", date: "2027-03-11" },
      { id: "2027-eid-ul-fitr-before", date: "2027-03-09", endDate: "2027-03-10" },
      { id: "2027-eid-ul-fitr-after", date: "2027-03-12", endDate: "2027-03-13" },
    );
    expect(after.getHoliday("2027-03-11")).toMatchObject({ id: "2027-eid-ul-fitr", dateStatus: "confirmed" });
    expect(after.isBusinessDay("2027-03-08")).toBe(true);
    expect(after.isBusinessDay("2027-03-13")).toBe(false);
  });
});

describe("Bangla UI widget", () => {
  it("renders the next holidays in Bangla", () => {
    const items = getUpcomingHolidays("2027-12-01", { locale: "bn-BD", limit: 2 }).map(
      (holiday) => `${holiday.name} — ${formatDate(holiday.date, "bn-BD", { weekday: true })}`,
    );
    expect(items).toEqual([
      "বিজয় দিবস — বৃহস্পতিবার, ১৬ ডিসেম্বর ২০২৭",
      "যিশুখ্রিষ্টের জন্মদিন (বড়দিন) — শনিবার, ২৫ ডিসেম্বর ২০২৭",
    ]);
    expect(`মোট ছুটি: ${toBanglaDigits(getHolidays(2027).length)}টি`).toBe("মোট ছুটি: ২৩টি");
  });
});
