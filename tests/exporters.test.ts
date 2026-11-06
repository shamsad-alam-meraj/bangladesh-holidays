import { describe, expect, it } from "vitest";
import { CSV_COLUMNS, createHolidayCalendar, exportHolidays, getHolidays, type Holiday } from "../src";
import { escapeIcsText, foldIcsLine } from "../src/exporters";

const FIXED = new Date(Date.UTC(2026, 10, 6, 12, 0, 0));
const calendar = createHolidayCalendar({ year: 2027 });

/** Minimal RFC 4180 parser for verification. */
function parseCsv(text: string, delimiter = ","): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === delimiter) {
      row.push(cell);
      cell = "";
    } else if (char === "\r" && text[i + 1] === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      i++;
    } else cell += char;
  }
  return rows;
}

/** Unfold ICS content lines. */
function unfold(ics: string): string[] {
  return ics.replace(/\r\n /g, "").split("\r\n").filter(Boolean);
}

describe("JSON export", () => {
  it("round-trips holidays with metadata", () => {
    const parsed = JSON.parse(calendar.export("json")) as {
      generator: string;
      count: number;
      from: string;
      to: string;
      locale: string;
      coverage: { status: string }[];
      holidays: Holiday[];
    };
    expect(parsed.generator).toMatch(/^bangladesh-holidays@\d+\.\d+\.\d+/);
    expect(parsed.count).toBe(23);
    expect(parsed.from).toBe("2027-01-01");
    expect(parsed.to).toBe("2027-12-31");
    expect(parsed.coverage[0]?.status).toBe("available");
    expect(parsed.holidays).toEqual(JSON.parse(JSON.stringify(calendar.getHolidays())));
  });

  it("supports compact output, ranges and locale", () => {
    const json = calendar.export("json", { indent: 0, from: "2027-03-01", to: "2027-03-31", locale: "bn" });
    expect(json).not.toContain("\n");
    const parsed = JSON.parse(json) as { holidays: Holiday[] };
    expect(parsed.holidays).toHaveLength(6);
    expect(parsed.holidays[0]?.name).toBe("জুমাতুল বিদা");
    expect(() => calendar.export("json", { indent: 11 })).toThrow(RangeError);
  });
});

describe("CSV export", () => {
  it("produces RFC 4180 output with a header row", () => {
    const csv = calendar.export("csv");
    expect(csv.endsWith("\r\n")).toBe(true);
    const rows = parseCsv(csv);
    expect(rows[0]).toEqual([...CSV_COLUMNS]);
    expect(rows).toHaveLength(24);
    const independence = rows.find((row) => row[0] === "2027-independence-day")!;
    const column = (name: (typeof CSV_COLUMNS)[number]) => independence[CSV_COLUMNS.indexOf(name)];
    expect(column("date")).toBe("2027-03-26");
    expect(column("nameBn")).toBe("স্বাধীনতা ও জাতীয় দিবস");
    expect(column("categoryLabel")).toBe("General holiday");
    expect(column("official")).toBe("true");
    expect(column("sourceReference")).toBe("05.00.0000.175.08.0008.25-105");
  });

  it("quotes commas, quotes and newlines and blocks formula injection", () => {
    const custom = createHolidayCalendar({
      year: 2027,
      calendars: [],
      customHolidays: [
        { date: "2027-06-01", name: 'Say "hi", team', description: "line1\nline2" },
        { date: "2027-06-02", name: '=HYPERLINK("x")' },
      ],
    });
    const rows = parseCsv(custom.export("csv"));
    expect(rows[1]?.[CSV_COLUMNS.indexOf("name")]).toBe('Say "hi", team');
    expect(rows[1]?.[CSV_COLUMNS.indexOf("description")]).toBe("line1\nline2");
    expect(rows[2]?.[CSV_COLUMNS.indexOf("name")]).toBe('\'=HYPERLINK("x")');
    const raw = parseCsv(custom.export("csv", { escapeFormulas: false }));
    expect(raw[2]?.[CSV_COLUMNS.indexOf("name")]).toBe('=HYPERLINK("x")');
  });

  it("supports BOM, delimiters and Bangla labels", () => {
    const csv = calendar.export("csv", { bom: true, delimiter: ";", locale: "bn-BD" });
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const rows = parseCsv(csv.slice(1), ";");
    expect(rows[1]?.[CSV_COLUMNS.indexOf("categoryLabel")]).toBe("নির্বাহী আদেশে ছুটি");
    expect(rows[1]?.[CSV_COLUMNS.indexOf("name")]).toBe("শব-ই-বরাত");
  });
});

describe("ICS export", () => {
  const ics = calendar.export("ics", { timestamp: FIXED });
  const lines = unfold(ics);

  it("produces a valid VCALENDAR envelope", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).not.toMatch(/[^\r]\n/);
    expect(lines).toContain("VERSION:2.0");
    expect(lines.some((line) => line.startsWith("PRODID:-//bangladesh-holidays//"))).toBe(true);
    expect(lines).toContain("CALSCALE:GREGORIAN");
    expect(lines).toContain("METHOD:PUBLISH");
    expect(lines.filter((l) => l === "BEGIN:VEVENT")).toHaveLength(23);
    expect(lines.filter((l) => l === "END:VEVENT")).toHaveLength(23);
  });

  it("uses all-day events with exclusive DTEND", () => {
    const start = lines.indexOf("UID:2027-eid-ul-azha-after@bangladesh-holidays");
    const event = lines.slice(start, lines.indexOf("END:VEVENT", start));
    expect(event).toContain("DTSTART;VALUE=DATE:20270518");
    expect(event).toContain("DTEND;VALUE=DATE:20270521");
    expect(event).toContain("DTSTAMP:20261106T120000Z");
    expect(event).toContain("STATUS:TENTATIVE");
    expect(event).toContain("TRANSP:TRANSPARENT");
    expect(event).toContain("X-MICROSOFT-CDO-ALLDAYEVENT:TRUE");
    expect(event.some((line) => line.startsWith("CATEGORIES:Executive-order holiday,Religious"))).toBe(true);
    expect(event.some((line) => line.startsWith("URL:https://mopa.gov.bd/"))).toBe(true);
    const independence = lines.indexOf("UID:2027-independence-day@bangladesh-holidays");
    expect(lines.slice(independence, independence + 6)).toContain("DTEND;VALUE=DATE:20270327");
  });

  it("folds long lines at 75 octets without splitting UTF-8 characters", () => {
    const bn = createHolidayCalendar({
      year: 2027,
      locale: "bn",
      includeOptionalHolidays: true,
      region: "all",
    });
    const raw = bn.export("ics", { timestamp: FIXED });
    for (const physical of raw.split("\r\n")) {
      expect(new TextEncoder().encode(physical).length).toBeLessThanOrEqual(75);
    }
    expect(unfold(raw)).toContain(
      "SUMMARY:বৈসাবি ও পার্বত্য চট্টগ্রামের অন্যান্য ক্ষুদ্র নৃ-গোষ্ঠীর অনুরূপ সামাজিক উৎসব",
    );
    expect(
      foldIcsLine("a".repeat(150))
        .split("\r\n")
        .map((l) => l.length),
    ).toEqual([75, 75, 2]);
  });

  it("escapes TEXT values", () => {
    expect(escapeIcsText("a,b;c\\d\ne")).toBe("a\\,b\\;c\\\\d\\ne");
  });

  it("adds reminders and options", () => {
    const withAlarms = calendar.export("ics", {
      timestamp: FIXED,
      reminders: [
        { minutesBefore: 1440 },
        { minutesBefore: 120, description: "Prepare" },
        { minutesBefore: 30 },
        { minutesBefore: 0 },
      ],
      calendarName: "Office, BD",
      busy: true,
      uidDomain: "example.com",
      from: "2027-12-01",
      to: "2027-12-31",
    });
    const alarmLines = unfold(withAlarms);
    expect(alarmLines.filter((l) => l === "BEGIN:VALARM")).toHaveLength(8);
    expect(alarmLines).toContain("TRIGGER:-P1D");
    expect(alarmLines).toContain("TRIGGER:-PT2H");
    expect(alarmLines).toContain("TRIGGER:-PT30M");
    expect(alarmLines).toContain("TRIGGER:PT0M");
    expect(alarmLines).toContain("DESCRIPTION:Prepare");
    expect(alarmLines).toContain("X-WR-CALNAME:Office\\, BD");
    expect(alarmLines).toContain("TRANSP:OPAQUE");
    expect(alarmLines).toContain("UID:2027-victory-day@example.com");
    expect(() => calendar.export("ics", { reminders: [{ minutesBefore: -5 }] })).toThrow(RangeError);
    expect(() => calendar.export("ics", { timestamp: new Date("x") })).toThrow(RangeError);
  });
});

describe("exportHolidays (standalone)", () => {
  it("exports any holiday list", () => {
    const holidays = getHolidays(2027, { month: 12 });
    type Doc = { count: number; holidays: Holiday[] };
    expect((JSON.parse(exportHolidays(holidays, "json")) as Doc).count).toBe(2);
    const bn = JSON.parse(exportHolidays(holidays, "json", { locale: "bn", indent: 0 })) as Doc;
    expect(bn.holidays[0]?.name).toBe("বিজয় দিবস");
    expect(parseCsv(exportHolidays(holidays, "csv"))).toHaveLength(3);
    expect(exportHolidays(holidays, "ics", { timestamp: FIXED })).toContain("SUMMARY:Victory Day");
    expect(() => exportHolidays(holidays, "pdf" as never)).toThrow(TypeError);
    expect(() => calendar.export("xml" as never)).toThrow(TypeError);
  });
});
