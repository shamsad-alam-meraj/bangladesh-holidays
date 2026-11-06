import { describe, expect, it } from "vitest";
import {
  ConfigurationError,
  DatasetValidationError,
  HolidayCalendar,
  HolidayDataUnavailableError,
  createHolidayCalendar,
  type HolidayDatasetInput,
} from "../src";

const acme2027: HolidayDatasetInput = {
  schemaVersion: 1,
  calendar: "acme",
  year: 2027,
  version: "1.0.0",
  status: "custom",
  lastUpdated: "2026-11-01",
  holidays: [
    {
      id: "acme-2027-retreat",
      nameEn: "Annual retreat",
      date: "2027-07-12",
      endDate: "2027-07-13",
      category: "corporate",
      type: "company",
      dateStatus: "scheduled",
    },
  ],
};

describe("createHolidayCalendar defaults", () => {
  it("resolves defaults", () => {
    const calendar = createHolidayCalendar();
    expect(calendar).toBeInstanceOf(HolidayCalendar);
    expect(calendar.options).toMatchObject({
      year: undefined,
      locale: "en",
      weekend: [5, 6],
      calendars: ["government"],
      includeOptionalHolidays: false,
      includeObservances: false,
      region: undefined,
      halfDayIsBusinessDay: true,
      onMissingData: "throw",
      dateInterpretation: "dhaka",
    });
    expect(Object.isFrozen(calendar.options)).toBe(true);
  });

  it("requires a year for year-less listing", () => {
    expect(() => createHolidayCalendar().getHolidays()).toThrow(ConfigurationError);
    expect(createHolidayCalendar({ year: 2027 }).getHolidays()).toHaveLength(23);
    expect(createHolidayCalendar().getHolidays({ year: 2027 })).toHaveLength(23);
  });
});

describe("the example configuration from the specification", () => {
  const calendar = createHolidayCalendar({
    year: 2027,
    locale: "bn-BD",
    weekend: [5, 6],
    calendars: ["government", "bank"],
    includeOptionalHolidays: true,
    includeObservances: false,
    customHolidays: [
      {
        date: "2027-06-01",
        name: "Company Foundation Day",
        nameBn: "কোম্পানি প্রতিষ্ঠা দিবস",
        type: "company",
      },
    ],
    excludedDates: [],
    workingDayOverrides: [],
  });

  it("throws because Bangladesh Bank 2027 data is unpublished", () => {
    expect(() => calendar.getHolidays()).toThrow(HolidayDataUnavailableError);
    try {
      calendar.isBusinessDay("2027-06-01");
    } catch (error) {
      expect(error).toBeInstanceOf(HolidayDataUnavailableError);
      expect((error as HolidayDataUnavailableError).calendar).toBe("bank");
      expect((error as HolidayDataUnavailableError).year).toBe(2027);
    }
  });

  it("works with onMissingData: 'ignore'", () => {
    const lenient = calendar.with({ onMissingData: "ignore" });
    expect(lenient.getHoliday("2027-06-01")?.name).toBe("কোম্পানি প্রতিষ্ঠা দিবস");
    expect(lenient.isBusinessDay("2027-06-01")).toBe(false);
    expect(lenient.getCoverage().map((c) => [c.calendar, c.status])).toEqual([
      ["government", "available"],
      ["bank", "unavailable"],
    ]);
    expect(lenient.getHolidays().filter((h) => h.category === "optional")).toHaveLength(31);
  });
});

describe("weekends", () => {
  it("supports custom weekends", () => {
    const sundayOff = createHolidayCalendar({ weekend: [0] });
    expect(sundayOff.isWeekend("2027-03-28")).toBe(true);
    expect(sundayOff.isWeekend("2027-03-27")).toBe(false);
    expect(sundayOff.isBusinessDay("2027-03-27")).toBe(true);
    const noWeekend = createHolidayCalendar({ weekend: [] });
    expect(noWeekend.isBusinessDay("2027-03-27")).toBe(true);
    expect(noWeekend.getWeekendDays(2027)).toEqual([]);
  });

  it.each([[[7]], [[-1]], [[1.5]], [[5, 5]], [[0, 1, 2, 3, 4, 5, 6]]])("rejects weekend %j", (weekend) => {
    expect(() => createHolidayCalendar({ weekend: weekend as never })).toThrow(ConfigurationError);
  });
});

describe("custom holidays, closures and recurring holidays", () => {
  it("adds one-off holidays and date-range closures", () => {
    const calendar = createHolidayCalendar({
      year: 2027,
      customHolidays: [
        {
          id: "office-move",
          date: "2027-07-05",
          endDate: "2027-07-07",
          name: "Office move",
          type: "closure",
        },
        { date: "2027-06-01", name: "Foundation Day" },
      ],
    });
    expect(calendar.getHoliday("2027-07-06")).toMatchObject({
      id: "office-move",
      category: "custom",
      type: "closure",
      durationDays: 3,
      official: false,
      verification: "unverified",
    });
    expect(calendar.getHoliday("2027-06-01")?.id).toBe("custom-2027-06-01-foundation-day");
    expect(calendar.countBusinessDays("2027-07-04", "2027-07-08")).toBe(2);
  });

  it("generates ids for Bangla-only names", () => {
    const calendar = createHolidayCalendar({ customHolidays: [{ date: "2027-06-02", name: "বার্ষিক সভা" }] });
    expect(calendar.getHoliday("2027-06-02")?.id).toBe("custom-2027-06-02-1");
  });

  it("supports recurring holidays, including 29 February only in leap years", () => {
    const calendar = createHolidayCalendar({
      onMissingData: "ignore",
      recurringHolidays: [
        { id: "founders", month: 6, day: 1, name: "Founders Day", fromYear: 2027 },
        { id: "leap", month: 2, day: 29, name: "Leap Day" },
        { id: "year-end", month: 12, day: 31, durationDays: 2, name: "Year-end closure", type: "closure" },
      ],
    });
    expect(calendar.getHoliday("2027-06-01")?.id).toBe("founders-2027");
    expect(calendar.getHoliday("2030-06-01")?.id).toBe("founders-2030");
    expect(calendar.isHoliday("2026-06-01")).toBe(false);
    expect(calendar.isHoliday("2028-02-29")).toBe(true);
    expect(calendar.getHolidays({ year: 2027, search: "leap" })).toEqual([]);
    // A recurring closure that crosses the year boundary appears in both years.
    expect(calendar.getHoliday("2028-01-01")?.id).toBe("year-end-2027");
    expect(calendar.getHolidays({ year: 2028 }).map((h) => h.id)).toContain("year-end-2027");
    expect(calendar.getUpcomingHolidays("2035-05-01", { limit: 1 })[0]?.id).toBe("founders-2035");
    expect(calendar.excludeHolidays("founders").isHoliday("2027-06-01")).toBe(false);
    expect(calendar.excludeHolidays("founders-2027").isHoliday("2028-06-01")).toBe(true);
  });

  it("supports half-day holidays", () => {
    const calendar = createHolidayCalendar({
      customHolidays: [{ date: "2027-06-03", name: "Half day", dayType: "half" }],
    });
    expect(calendar.isBusinessDay("2027-06-03")).toBe(true);
    expect(calendar.isHalfDay("2027-06-03")).toBe(true);
    expect(calendar.getDayInfo("2027-06-03").reason).toBe("half-day");
    expect(calendar.with({ halfDayIsBusinessDay: false }).isBusinessDay("2027-06-03")).toBe(false);
    expect(calendar.isHalfDay("2027-06-02")).toBe(false);
  });

  it("supports substitute holidays", () => {
    const calendar = createHolidayCalendar({
      customHolidays: [
        {
          date: "2027-11-08",
          name: "Substitute for 7 November",
          substituteFor: "2027-national-revolution-solidarity-day",
        },
      ],
    });
    expect(calendar.getHoliday("2027-11-08")?.substituteFor).toBe("2027-national-revolution-solidarity-day");
  });

  it.each([
    [{ date: "2027-02-30", name: "x" }, /valid YYYY-MM-DD/],
    [{ date: "2027-06-02", endDate: "2027-06-01", name: "x" }, /before date/],
    [{ date: "2027-06-02", name: " " }, /name/],
    [{ date: "2027-06-02", name: "x", category: "nope" }, /category/],
    [{ date: "2027-06-02", name: "x", id: "Bad Id" }, /id/],
    [{ date: "2027-06-02", name: "x", id: "2027-victory-day" }, /collides/],
  ])("rejects invalid custom holiday %j", (holiday, message) => {
    expect(() => createHolidayCalendar({ customHolidays: [holiday as never] })).toThrow(message);
  });

  it("rejects duplicate custom ids and invalid recurring rules", () => {
    expect(() =>
      createHolidayCalendar({
        customHolidays: [
          { id: "a", date: "2027-06-01", name: "A" },
          { id: "a", date: "2027-06-02", name: "B" },
        ],
      }),
    ).toThrow(/Duplicate/);
    expect(() =>
      createHolidayCalendar({ recurringHolidays: [{ id: "x", month: 2, day: 30, name: "x" }] }),
    ).toThrow(ConfigurationError);
    expect(() =>
      createHolidayCalendar({ recurringHolidays: [{ id: "x", month: 13, day: 1, name: "x" }] }),
    ).toThrow(ConfigurationError);
    expect(() =>
      createHolidayCalendar({
        recurringHolidays: [{ id: "x", month: 1, day: 1, name: "x", fromYear: 2030, toYear: 2029 }],
      }),
    ).toThrow(ConfigurationError);
    expect(() =>
      createHolidayCalendar({
        recurringHolidays: [{ id: "x", month: 1, day: 1, name: "x", durationDays: 0 }],
      }),
    ).toThrow(ConfigurationError);
  });
});

describe("precedence rules", () => {
  it("1. working-day overrides beat holidays and weekends", () => {
    const calendar = createHolidayCalendar({ workingDayOverrides: ["2027-03-26", "2027-03-27"] });
    expect(calendar.isBusinessDay("2027-03-26")).toBe(true);
    expect(calendar.isBusinessDay("2027-03-27")).toBe(true);
    const info = calendar.getDayInfo("2027-03-26");
    expect(info).toMatchObject({
      isHoliday: true,
      isWorkingDayOverride: true,
      isBusinessDay: true,
      reason: "working-day-override",
    });
  });

  it("2. excluded dates and ids remove holidays but not weekends", () => {
    const calendar = createHolidayCalendar({
      year: 2027,
      excludedDates: ["2027-03-26", "2027-03-09"],
      excludedHolidayIds: ["2027-victory-day"],
    });
    expect(calendar.isHoliday("2027-03-26")).toBe(false);
    expect(calendar.isBusinessDay("2027-03-26")).toBe(false); // still a Friday
    expect(calendar.getDayInfo("2027-03-26").reason).toBe("weekend");
    expect(calendar.isHoliday("2027-03-09")).toBe(false);
    expect(calendar.isBusinessDay("2027-03-09")).toBe(true);
    expect(calendar.isHoliday("2027-03-08")).toBe(true);
    expect(calendar.getHolidays().map((h) => h.id)).toContain("2027-eid-ul-fitr-before");
    expect(calendar.getHolidays().map((h) => h.id)).not.toContain("2027-independence-day");
    expect(calendar.isHoliday("2027-12-16")).toBe(false);
  });

  it("3. holiday date overrides move moon-dependent holidays", () => {
    const calendar = createHolidayCalendar({
      year: 2027,
      holidayOverrides: [
        { id: "2027-eid-ul-fitr", date: "2027-03-11" },
        { id: "2027-eid-ul-fitr-after", date: "2027-03-12" },
      ],
    });
    expect(calendar.isHoliday("2027-03-10")).toBe(false);
    expect(calendar.getHoliday("2027-03-11")).toMatchObject({
      id: "2027-eid-ul-fitr",
      dateStatus: "confirmed",
      metadata: { originalDate: "2027-03-10" },
    });
    // Multi-day holidays keep their length unless an endDate is given.
    expect(calendar.getHolidayById("2027-eid-ul-fitr-after")).toMatchObject({
      date: "2027-03-12",
      endDate: "2027-03-13",
    });
    const updated = calendar.overrideHolidayDates({
      id: "2027-eid-ul-fitr",
      date: "2027-03-10",
      dateStatus: "confirmed",
    });
    expect(updated.getHoliday("2027-03-10")?.dateStatus).toBe("confirmed");
    expect(updated.options.year).toBe(2027);
  });

  it("4. half-day holidays do not override full-day holidays", () => {
    const calendar = createHolidayCalendar({
      customHolidays: [{ date: "2027-03-26", name: "Half", dayType: "half" }],
    });
    expect(calendar.getDayInfo("2027-03-26")).toMatchObject({
      isHalfDay: false,
      isBusinessDay: false,
      reason: "holiday",
    });
  });

  it("detects conflicting configuration", () => {
    expect(() =>
      createHolidayCalendar({
        customHolidays: [{ date: "2027-06-01", endDate: "2027-06-03", name: "Closure" }],
        workingDayOverrides: ["2027-06-02"],
      }),
    ).toThrow(/Conflicting configuration/);
    expect(() =>
      createHolidayCalendar({
        holidayOverrides: [
          { id: "2027-eid-ul-fitr", date: "2027-03-11" },
          { id: "2027-eid-ul-fitr", date: "2027-03-12" },
        ],
      }),
    ).toThrow(/Conflicting holidayOverrides/);
    expect(() => createHolidayCalendar({ holidayOverrides: [{ id: "nope", date: "2027-03-11" }] })).toThrow(
      /unknown/,
    );
    expect(() =>
      createHolidayCalendar({
        holidayOverrides: [{ id: "2027-eid-ul-fitr", date: "2027-03-11", endDate: "2027-03-01" }],
      }),
    ).toThrow(/before date/);
    expect(() => createHolidayCalendar({ excludedHolidayIds: ["typo"] })).toThrow(/unknown holiday id/);
  });
});

describe("calendar sources and custom datasets", () => {
  it("rejects unknown calendars and invalid options", () => {
    expect(() => createHolidayCalendar({ calendars: ["nope"] })).toThrow(/Unknown calendar/);
    expect(() => createHolidayCalendar({ calendars: ["government", "government"] })).toThrow(/duplicates/);
    expect(() => createHolidayCalendar({ locale: "fr" as never })).toThrow(/Unsupported locale/);
    expect(() => createHolidayCalendar({ year: 0 })).toThrow(RangeError);
    expect(() => createHolidayCalendar({ region: "  " })).toThrow(/region/);
    expect(() => createHolidayCalendar({ onMissingData: "maybe" as never })).toThrow(/onMissingData/);
    expect(() => createHolidayCalendar({ optionalHolidayCommunities: ["jedi" as never] })).toThrow(
      ConfigurationError,
    );
    expect(() => createHolidayCalendar({ excludedDates: ["2027-13-01"] })).toThrow(ConfigurationError);
    expect(() => new HolidayCalendar(null as never)).toThrow(ConfigurationError);
  });

  it("loads custom datasets and enables their calendar automatically", () => {
    const calendar = createHolidayCalendar({ year: 2027, datasets: [acme2027] });
    expect(calendar.options.calendars).toEqual(["government", "acme"]);
    expect(calendar.getHoliday("2027-07-13")?.id).toBe("acme-2027-retreat");
    expect(calendar.getHoliday("2027-07-13")?.calendar).toBe("acme");
    expect(calendar.getHolidays({ calendar: "acme" })).toHaveLength(1);
    expect(createHolidayCalendar({ datasets: [acme2027], calendars: ["acme"] }).isHoliday("2027-03-26")).toBe(
      false,
    );
  });

  it("lets a custom dataset replace a built-in calendar/year", () => {
    const replacement: HolidayDatasetInput = { ...acme2027, calendar: "government", holidays: [] };
    const calendar = createHolidayCalendar({ datasets: [replacement] });
    expect(calendar.isHoliday("2027-03-26")).toBe(false);
    expect(calendar.getCoverage(2027)[0]?.datasetVersion).toBe("1.0.0");
  });

  it("rejects invalid or duplicate custom datasets", () => {
    expect(() => createHolidayCalendar({ datasets: [{ ...acme2027, year: 2026 }] })).toThrow(
      DatasetValidationError,
    );
    expect(() => createHolidayCalendar({ datasets: [acme2027, acme2027] })).toThrow(/Two custom datasets/);
  });

  it("does not freeze or mutate the caller's dataset", () => {
    const input = structuredClone(acme2027);
    createHolidayCalendar({ datasets: [input] });
    expect(Object.isFrozen(input)).toBe(false);
    expect(input).toEqual(acme2027);
  });

  it("treats empty datasets as data with no holidays", () => {
    const empty: HolidayDatasetInput = { ...acme2027, year: 2028, holidays: [] };
    const calendar = createHolidayCalendar({ calendars: ["acme"], datasets: [empty] });
    expect(calendar.getHolidays({ year: 2028 })).toEqual([]);
    expect(calendar.isBusinessDay("2028-01-03")).toBe(true);
    expect(calendar.getHolidayStatistics(2028).totalHolidays).toBe(0);
    expect(calendar.getLongWeekends(2028)).toEqual([]);
  });
});

describe("optional holidays, observances and regions", () => {
  it("filters optional holidays by community", () => {
    const hindu = createHolidayCalendar({
      includeOptionalHolidays: true,
      optionalHolidayCommunities: ["hindu"],
    });
    expect(hindu.isHoliday("2027-10-07")).toBe(true);
    expect(hindu.isHoliday("2027-03-28")).toBe(false);
    expect(hindu.getHolidays({ year: 2027, category: "optional" })).toHaveLength(8);
  });

  it("applies the Buddhist Chaitra Sankranti optional holiday outside the hill districts only", () => {
    const base = { includeOptionalHolidays: true, optionalHolidayCommunities: ["buddhist" as const] };
    expect(
      createHolidayCalendar(base)
        .getHolidaysOn("2027-04-13")
        .map((h) => h.id),
    ).toEqual(["2027-chaitra-sankranti-buddhist"]);
    expect(
      createHolidayCalendar({ ...base, region: "khagrachari" })
        .getHolidaysOn("2027-04-13")
        .map((h) => h.id),
    ).toEqual(["2027-chaitra-sankranti"]);
  });

  it("lists observances only when enabled and never treats them as days off", () => {
    const observance = {
      date: "2027-03-17",
      name: "Observance",
      category: "observance" as const,
      type: "observance" as const,
    };
    const hidden = createHolidayCalendar({ year: 2027, customHolidays: [observance] });
    expect(hidden.getHolidays().some((h) => h.category === "observance")).toBe(false);
    const shown = hidden.with({ includeObservances: true });
    expect(shown.getHolidays().some((h) => h.category === "observance")).toBe(true);
    expect(shown.isHoliday("2027-03-17")).toBe(false);
    expect(shown.isBusinessDay("2027-03-17")).toBe(true);
    expect(shown.getDayInfo("2027-03-17").observances).toHaveLength(1);
  });
});

describe("immutable runtime updates", () => {
  it("returns new calendars and leaves the original unchanged", () => {
    const original = createHolidayCalendar({ year: 2027 });
    const updated = original
      .addCustomHolidays({ date: "2027-06-01", name: "Foundation Day" })
      .addWorkingDayOverrides("2027-03-27")
      .addExcludedDates("2027-12-16")
      .addRecurringHolidays({ id: "picnic", month: 1, day: 30, name: "Picnic" })
      .setLocale("bn")
      .setWeekend([5])
      .setYear(2027);
    expect(original.isHoliday("2027-06-01")).toBe(false);
    expect(updated.isHoliday("2027-06-01")).toBe(true);
    expect(updated.isBusinessDay("2027-03-27")).toBe(true);
    expect(updated.isHoliday("2027-12-16")).toBe(false);
    expect(updated.isHoliday("2027-01-30")).toBe(true);
    expect(updated.options.locale).toBe("bn");
    expect(updated.isWeekend("2027-03-20")).toBe(false);
    expect(original.options.locale).toBe("en");
    expect(updated.getConfig().customHolidays).toHaveLength(1);
  });

  it("hasDataFor reports coverage without throwing", () => {
    const calendar = createHolidayCalendar();
    expect(calendar.hasDataFor(2027)).toBe(true);
    expect(calendar.hasDataFor(2028)).toBe(false);
    expect(calendar.getCoverage(2028)[0]).toMatchObject({ status: "unavailable" });
    expect(() => calendar.getCoverage()).toThrow(ConfigurationError);
  });
});
