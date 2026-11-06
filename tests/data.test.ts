/**
 * Verifies the bundled 2027 dataset against facts transcribed independently
 * from the MoPA notification (memo 05.00.0000.175.08.0008.25-105, 05 Nov 2026):
 * the printed weekday of every date, the per-section totals, the weekend counts
 * printed under each table, the asterisked (moon-sighting) entries, and the
 * printed Bangla calendar dates.
 */
import { describe, expect, it } from "vitest";
import {
  addDays,
  formatBengaliDate,
  getDataset,
  getWeekday,
  getWeekdayName,
  validateHolidayDataset,
} from "../src";
import government2027 from "../src/data/government/2027.json";

const dataset = getDataset("government", 2027)!;
const byId = new Map(dataset.holidays.map((holiday) => [holiday.id, holiday]));

/** Weekday(s) exactly as printed in the notice, keyed by id (without the "2027-" prefix). */
const PRINTED_WEEKDAYS: Record<string, string[]> = {
  // (ক) general holidays
  "shaheed-day": ["রবিবার"],
  "jumatul-bida": ["শুক্রবার"],
  "eid-ul-fitr": ["বুধবার"],
  "independence-day": ["শুক্রবার"],
  "chaitra-sankranti": ["মঙ্গলবার"],
  "may-day": ["শনিবার"],
  "eid-ul-azha": ["সোমবার"],
  "buddha-purnima": ["বৃহস্পতিবার"],
  "july-uprising-day": ["বৃহস্পতিবার"],
  "eid-e-miladunnabi": ["রবিবার"],
  janmashtami: ["বুধবার"],
  "durga-puja-bijoya-dashami": ["রবিবার"],
  "national-revolution-solidarity-day": ["রবিবার"],
  "victory-day": ["বৃহস্পতিবার"],
  "christmas-day": ["শনিবার"],
  // (খ) executive-order holidays
  "shab-e-barat": ["রবিবার"],
  "shab-e-qadr": ["রবিবার"],
  "eid-ul-fitr-before": ["সোমবার", "মঙ্গলবার"],
  "eid-ul-fitr-after": ["বৃহস্পতিবার", "শুক্রবার"],
  "bengali-new-year": ["বুধবার"],
  "eid-ul-azha-before": ["শনিবার", "রবিবার"],
  "eid-ul-azha-after": ["মঙ্গলবার", "বুধবার", "বৃহস্পতিবার"],
  ashura: ["বুধবার"],
  "durga-puja-nabami": ["শনিবার"],
  // (গ) optional — Muslim
  "shab-e-miraj-january": ["বুধবার"],
  "eid-ul-fitr-third-day-after": ["শনিবার"],
  "eid-ul-azha-fourth-day-after": ["শুক্রবার"],
  "akheri-chahar-shomba": ["বুধবার"],
  "fateha-e-yazdaham": ["সোমবার"],
  "shab-e-miraj-december": ["রবিবার"],
  // (ঘ) optional — Hindu
  "saraswati-puja": ["বৃহস্পতিবার"],
  shivaratri: ["শনিবার"],
  "dol-jatra": ["সোমবার"],
  "harichand-thakur-appearance-day": ["রবিবার"],
  mahalaya: ["বৃহস্পতিবার"],
  "durga-puja-saptami-ashtami": ["বৃহস্পতিবার", "শুক্রবার"],
  "lakshmi-puja": ["বৃহস্পতিবার"],
  "shyama-puja": ["বৃহস্পতিবার"],
  // (ঙ) optional — Christian
  "english-new-year": ["শুক্রবার"],
  "ash-wednesday": ["বুধবার"],
  "maundy-thursday": ["বৃহস্পতিবার"],
  "good-friday": ["শুক্রবার"],
  "holy-saturday": ["শনিবার"],
  "easter-sunday": ["রবিবার"],
  "christmas-day-before": ["শুক্রবার"],
  "christmas-day-after": ["রবিবার"],
  // (চ) optional — Buddhist
  "maghi-purnima": ["শনিবার"],
  "chaitra-sankranti-buddhist": ["মঙ্গলবার"],
  "buddha-purnima-day-before": ["বুধবার"],
  "buddha-purnima-day-after": ["শুক্রবার"],
  "ashari-purnima": ["রবিবার"],
  "madhu-purnima": ["বুধবার"],
  "prabarana-purnima": ["বৃহস্পতিবার"],
  // (ছ) optional — ethnic minority communities
  "baisabi-first-day": ["সোমবার"],
  "baisabi-second-day": ["বৃহস্পতিবার"],
};

/** Entries marked with an asterisk (moon sighting / lunar tithi) in the notice. */
const ASTERISKED = [
  "eid-ul-fitr",
  "eid-ul-azha",
  "buddha-purnima",
  "eid-e-miladunnabi",
  "shab-e-barat",
  "shab-e-qadr",
  "eid-ul-fitr-before",
  "eid-ul-fitr-after",
  "eid-ul-azha-before",
  "eid-ul-azha-after",
  "ashura",
  "shab-e-miraj-january",
  "eid-ul-fitr-third-day-after",
  "eid-ul-azha-fourth-day-after",
  "akheri-chahar-shomba",
  "fateha-e-yazdaham",
  "shab-e-miraj-december",
  "maghi-purnima",
  "ashari-purnima",
  "madhu-purnima",
  "prabarana-purnima",
].map((id) => `2027-${id}`);

/** Totals printed under each section: [total days, of which on weekly holidays]. */
const SECTION_TOTALS: Record<string, [number, number | undefined]> = {
  ক: [15, 4],
  খ: [14, 3],
  গ: [6, 2],
  ঘ: [9, 2],
  ঙ: [8, 4],
  চ: [7, 2],
  ছ: [2, undefined],
};

function daysOf(holiday: { date: string; endDate?: string }): string[] {
  const days: string[] = [];
  for (let day = holiday.date; day <= (holiday.endDate ?? holiday.date); day = addDays(day, 1))
    days.push(day);
  return days;
}

describe("bundled government 2027 dataset", () => {
  it("passes schema validation with no errors or warnings", () => {
    const result = validateHolidayDataset(government2027);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it("cites the official MoPA notification", () => {
    expect(dataset.status).toBe("official");
    expect(dataset.source?.reference).toBe("05.00.0000.175.08.0008.25-105");
    expect(dataset.source?.referenceBn).toBe("০৫.০০.০০০০.১৭৫.০৮.০০০৮.২৫-১০৫");
    expect(dataset.source?.publishedDate).toBe("2026-11-05");
    expect(dataset.source?.url).toMatch(/^https:\/\/mopa\.gov\.bd\//);
    for (const holiday of dataset.holidays) {
      expect(holiday.official).toBe(true);
      expect(holiday.verification).toBe("verified");
      expect(holiday.source?.reference).toBe(dataset.source?.reference);
      expect(holiday.announcementDate).toBe("2026-11-05");
      expect(holiday.calendar).toBe("government");
    }
  });

  it("contains exactly the records of the notice", () => {
    expect(dataset.holidays.map((h) => h.id).sort()).toEqual(
      Object.keys(PRINTED_WEEKDAYS)
        .map((id) => `2027-${id}`)
        .sort(),
    );
  });

  it.each(Object.entries(PRINTED_WEEKDAYS))("2027-%s falls on the printed weekday(s)", (id, weekdays) => {
    const holiday = byId.get(`2027-${id}`)!;
    expect(daysOf(holiday).map((day) => getWeekdayName(getWeekday(day), "bn"))).toEqual(weekdays);
  });

  it.each(dataset.holidays.map((h) => [h.id, h] as const))(
    "%s matches the printed Bangla dates",
    (_id, holiday) => {
      expect(holiday.notice?.bengaliDates).toBeDefined();
      expect(daysOf(holiday).map((day) => formatBengaliDate(day))).toEqual(holiday.notice?.bengaliDates);
    },
  );

  it.each(Object.entries(SECTION_TOTALS))(
    "section (%s) matches the printed totals",
    (section, [total, weekend]) => {
      const records = dataset.holidays.filter((holiday) => holiday.notice?.section === section);
      const days = records.flatMap(daysOf);
      expect(days).toHaveLength(total);
      if (weekend !== undefined) {
        expect(days.filter((day) => [5, 6].includes(getWeekday(day)))).toHaveLength(weekend);
      }
    },
  );

  it("maps sections to categories", () => {
    for (const holiday of dataset.holidays) {
      const expected =
        holiday.notice?.section === "ক"
          ? "general"
          : holiday.notice?.section === "খ"
            ? "executive-order"
            : "optional";
      expect(holiday.category).toBe(expected);
    }
  });

  it("marks exactly the asterisked entries as tentative", () => {
    const tentative = dataset.holidays.filter((h) => h.dateStatus === "tentative").map((h) => h.id);
    expect(tentative.sort()).toEqual([...ASTERISKED].sort());
    expect(dataset.holidays.every((h) => h.dateStatus === "tentative" || h.dateStatus === "scheduled")).toBe(
      true,
    );
  });

  it("records community and regional scope of optional and regional holidays", () => {
    const communities = {
      গ: "muslim",
      ঘ: "hindu",
      ঙ: "christian",
      চ: "buddhist",
      ছ: "ethnic-minority",
    } as const;
    for (const holiday of dataset.holidays.filter((h) => h.category === "optional")) {
      const section = holiday.notice!.section as keyof typeof communities;
      expect(holiday.communities).toEqual([communities[section]]);
    }
    expect(byId.get("2027-chaitra-sankranti")?.regions).toEqual({
      include: ["rangamati", "khagrachari", "bandarban"],
    });
    expect(byId.get("2027-chaitra-sankranti-buddhist")?.regions).toEqual({
      exclude: ["rangamati", "khagrachari", "bandarban"],
    });
  });

  it("is deeply frozen", () => {
    expect(Object.isFrozen(dataset)).toBe(true);
    expect(Object.isFrozen(dataset.holidays)).toBe(true);
    expect(Object.isFrozen(dataset.holidays[0])).toBe(true);
    expect(() => {
      (dataset.holidays as unknown as unknown[]).push({});
    }).toThrow(TypeError);
  });
});
