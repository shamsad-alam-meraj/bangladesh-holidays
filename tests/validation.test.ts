import { describe, expect, it } from "vitest";
import {
  DatasetValidationError,
  assertValidHolidayDataset,
  normalizeDataset,
  validateHolidayDataset,
  type HolidayDatasetInput,
} from "../src";

function dataset(overrides: Partial<HolidayDatasetInput> = {}): HolidayDatasetInput {
  return {
    schemaVersion: 1,
    calendar: "acme",
    year: 2027,
    version: "1.0.0",
    status: "custom",
    lastUpdated: "2026-11-01",
    holidays: [
      {
        id: "a",
        nameEn: "A",
        date: "2027-01-10",
        category: "corporate",
        type: "company",
        dateStatus: "scheduled",
      },
    ],
    ...overrides,
  };
}

function codes(input: unknown): string[] {
  return validateHolidayDataset(input).errors.map((issue) => issue.code);
}

describe("validateHolidayDataset", () => {
  it("accepts a valid dataset", () => {
    expect(validateHolidayDataset(dataset())).toEqual({ valid: true, errors: [], warnings: [] });
  });

  it("accepts an empty dataset", () => {
    expect(validateHolidayDataset(dataset({ holidays: [] })).valid).toBe(true);
  });

  it.each([null, [], "x", 42])("rejects non-object input %j", (input) => {
    expect(codes(input)).toEqual(["invalid-structure"]);
  });

  it("checks top-level fields", () => {
    const result = validateHolidayDataset({
      schemaVersion: 2,
      calendar: "Bad Calendar",
      year: 20270,
      version: "v1",
      status: "draft",
      lastUpdated: "2026-13-01",
      notes: [1],
      source: { title: "", url: "ftp://x" },
      holidays: {},
    });
    expect(result.valid).toBe(false);
    expect(result.errors.map((e) => e.path)).toEqual(
      expect.arrayContaining([
        "schemaVersion",
        "calendar",
        "year",
        "version",
        "$.status",
        "$.lastUpdated",
        "notes",
        "source.title",
        "source.url",
        "holidays",
      ]),
    );
  });

  it("detects invalid dates and ranges", () => {
    const result = validateHolidayDataset(
      dataset({
        holidays: [
          {
            id: "a",
            nameEn: "A",
            date: "2027-02-29",
            category: "custom",
            type: "other",
            dateStatus: "scheduled",
          },
          {
            id: "b",
            nameEn: "B",
            date: "2027-03-10",
            endDate: "2027-03-09",
            category: "custom",
            type: "other",
            dateStatus: "scheduled",
          },
          {
            id: "c",
            nameEn: "C",
            date: "2028-01-01",
            category: "custom",
            type: "other",
            dateStatus: "scheduled",
          },
        ],
      }),
    );
    expect(result.errors.map((e) => [e.code, e.holidayId])).toEqual([
      ["invalid-date", "a"],
      ["end-before-start", "b"],
      ["year-mismatch", "c"],
    ]);
  });

  it("detects duplicate ids and duplicate holidays", () => {
    const base = {
      nameEn: "Same",
      date: "2027-05-01",
      category: "custom",
      type: "other",
      dateStatus: "scheduled",
    } as const;
    expect(
      codes(
        dataset({
          holidays: [
            { ...base, id: "x" },
            { ...base, id: "x" },
          ],
        }),
      ),
    ).toEqual(["duplicate-id", "duplicate-holiday"]);
    expect(
      codes(
        dataset({
          holidays: [
            { ...base, id: "x" },
            { ...base, id: "y" },
          ],
        }),
      ),
    ).toEqual(["duplicate-holiday"]);
    // Different holidays on the same date are allowed (e.g. 20 May 2027).
    expect(
      codes(
        dataset({
          holidays: [
            { ...base, id: "x" },
            { ...base, id: "y", nameEn: "Other" },
          ],
        }),
      ),
    ).toEqual([]);
  });

  it("checks holiday fields", () => {
    const result = validateHolidayDataset(
      dataset({
        holidays: [
          "nope" as never,
          {
            id: "Bad ID",
            nameEn: "",
            date: "2027-01-01",
            category: "public",
            type: "fun",
            dateStatus: "maybe",
            dayType: "quarter",
            official: "yes",
            communities: ["jedi"],
            regions: {},
            metadata: { ok: 1, bad: { nested: true } },
            notice: { section: 1 },
            verification: "trust-me",
          } as never,
          {
            id: "z",
            nameEn: "Z",
            date: "2027-01-02",
            category: "custom",
            type: "other",
            dateStatus: "scheduled",
            regions: { include: [] },
            metadata: [] as never,
            notice: { section: "ক", serial: 1, bengaliDates: [] },
          },
        ],
      }),
    );
    const paths = result.errors.map((e) => e.path);
    expect(paths).toEqual(
      expect.arrayContaining([
        "holidays[0]",
        "holidays[1].id",
        "holidays[1].nameEn",
        "holidays[1].category",
        "holidays[1].type",
        "holidays[1].dateStatus",
        "holidays[1].dayType",
        "holidays[1].official",
        "holidays[1].communities[0]",
        "holidays[1].regions",
        "holidays[1].metadata.bad",
        "holidays[1].notice",
        "holidays[1].verification",
        "holidays[2].regions.include",
        "holidays[2].metadata",
        "holidays[2].notice.bengaliDates",
      ]),
    );
  });

  it("requires sources for official data and forbids official estimates", () => {
    const holiday = {
      id: "a",
      nameEn: "A",
      date: "2027-01-10",
      category: "general",
      type: "national",
    } as const;
    expect(
      codes(dataset({ status: "official", holidays: [{ ...holiday, dateStatus: "scheduled" }] })),
    ).toEqual(["missing-source"]);
    expect(
      codes(
        dataset({
          status: "official",
          source: { title: "Notice" },
          holidays: [{ ...holiday, dateStatus: "estimated" }],
        }),
      ),
    ).toEqual(["official-estimate"]);
    expect(
      codes(dataset({ status: "provisional", holidays: [{ ...holiday, dateStatus: "estimated" }] })),
    ).toEqual([]);
  });

  it("warns when a moon-dependent holiday is marked scheduled", () => {
    const result = validateHolidayDataset(
      dataset({
        holidays: [
          {
            id: "a",
            nameEn: "Eid",
            date: "2027-03-10",
            category: "custom",
            type: "religious",
            dateStatus: "scheduled",
            descriptionEn: "Depends on moon sighting",
          },
        ],
      }),
    );
    expect(result.valid).toBe(true);
    expect(result.warnings.map((w) => w.code)).toEqual(["lunar-without-status"]);
  });

  it("accepts multi-day holidays that end in the next year", () => {
    const result = validateHolidayDataset(
      dataset({
        holidays: [
          {
            id: "a",
            nameEn: "Year-end",
            date: "2027-12-31",
            endDate: "2028-01-02",
            category: "corporate",
            type: "closure",
            dateStatus: "scheduled",
          },
        ],
      }),
    );
    expect(result.valid).toBe(true);
  });
});

describe("assertValidHolidayDataset / normalizeDataset", () => {
  it("throws a descriptive error", () => {
    const bad = dataset({ year: 2026 });
    expect(() => assertValidHolidayDataset(bad)).toThrow(DatasetValidationError);
    try {
      assertValidHolidayDataset(bad, "acme.json");
    } catch (error) {
      expect((error as DatasetValidationError).message).toMatch(/^acme\.json is invalid:/);
      expect((error as DatasetValidationError).issues[0]?.code).toBe("year-mismatch");
    }
  });

  it("summarizes long error lists", () => {
    const holidays = Array.from({ length: 12 }, (_, i) => ({
      id: `h${i}`,
      nameEn: `H${i}`,
      date: "2027-02-30",
      category: "custom" as const,
      type: "other" as const,
      dateStatus: "scheduled" as const,
    }));
    expect(() => assertValidHolidayDataset(dataset({ holidays }))).toThrow(/and 2 more/);
  });

  it("applies defaults and freezes", () => {
    const normalized = normalizeDataset(
      dataset({ status: "official", source: { title: "Notice", publishedDate: "2026-11-05" } }),
    );
    expect(normalized.holidays[0]).toMatchObject({
      calendar: "acme",
      dayType: "full",
      official: true,
      verification: "verified",
      source: { title: "Notice" },
      announcementDate: "2026-11-05",
    });
    expect(normalized.notes).toEqual([]);
    expect(Object.isFrozen(normalized.holidays[0])).toBe(true);
    const custom = normalizeDataset(dataset());
    expect(custom.holidays[0]).toMatchObject({ official: false, verification: "unverified" });
    expect(custom.holidays[0]?.source).toBeUndefined();
  });
});
