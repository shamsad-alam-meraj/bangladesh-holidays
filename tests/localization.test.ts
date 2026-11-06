import { describe, expect, it } from "vitest";
import {
  BENGALI_MONTHS_BN,
  SUPPORTED_LOCALES,
  createHolidayCalendar,
  formatBengaliDate,
  formatDate,
  formatNumber,
  fromBengaliDate,
  getBengaliMonthLengths,
  getCategoryLabel,
  getCommunityLabel,
  getDateStatusLabel,
  getHoliday,
  getHolidays,
  getMonthName,
  getTypeLabel,
  getWeekdayName,
  isBanglaLocale,
  isSupportedLocale,
  localizeHoliday,
  toBanglaDigits,
  toBengaliDate,
  toLatinDigits,
} from "../src";

describe("locales", () => {
  it("supports en, en-BD, bn and bn-BD", () => {
    expect(SUPPORTED_LOCALES).toEqual(["en", "en-BD", "bn", "bn-BD"]);
    expect(isSupportedLocale("bn-BD")).toBe(true);
    expect(isSupportedLocale("bn-IN")).toBe(false);
    expect(isBanglaLocale("bn")).toBe(true);
    expect(isBanglaLocale("en-BD")).toBe(false);
  });

  it.each([
    ["en", "Independence and National Day"],
    ["en-BD", "Independence and National Day"],
    ["bn", "স্বাধীনতা ও জাতীয় দিবস"],
    ["bn-BD", "স্বাধীনতা ও জাতীয় দিবস"],
  ] as const)("names holidays in %s", (locale, name) => {
    const holiday = getHoliday("2027-03-26", { locale });
    expect(holiday?.name).toBe(name);
    expect(holiday?.locale).toBe(locale);
    expect(holiday?.nameEn).toBe("Independence and National Day");
    expect(holiday?.nameBn).toBe("স্বাধীনতা ও জাতীয় দিবস");
  });

  it("localizes descriptions with English fallback for names", () => {
    expect(getHoliday("2027-02-21", { locale: "bn" })?.description).toMatch(/ভাষা আন্দোলনের/);
    expect(getHoliday("2027-02-21")?.description).toMatch(/Language Movement/);
    const calendar = createHolidayCalendar({
      locale: "bn",
      customHolidays: [{ date: "2027-06-01", name: "Retreat" }],
    });
    expect(calendar.getHoliday("2027-06-01")?.name).toBe("Retreat");
    expect(calendar.getHoliday("2027-06-01")?.description).toBeUndefined();
  });

  it("every built-in holiday has a Bangla name", () => {
    for (const holiday of getHolidays(2027, { locale: "bn", includeOptionalHolidays: true, region: "all" })) {
      expect(holiday.name).toBe(holiday.nameBn);
      expect(holiday.name).toMatch(/[ঀ-৿]/);
    }
  });

  it("re-localizes an existing holiday", () => {
    const en = getHoliday("2027-12-16")!;
    const bn = localizeHoliday(en, "bn-BD");
    expect(bn.name).toBe("বিজয় দিবস");
    expect(localizeHoliday(bn, "en").name).toBe("Victory Day");
    expect(localizeHoliday(bn, "en").description).toBe(en.description);
  });
});

describe("numerals and labels", () => {
  it("converts digits both ways", () => {
    expect(toBanglaDigits(2027)).toBe("২০২৭");
    expect(toBanglaDigits("2027-03-26")).toBe("২০২৭-০৩-২৬");
    expect(toLatinDigits("২০২৭-০৩-২৬")).toBe("2027-03-26");
    expect(toLatinDigits(toBanglaDigits("0123456789"))).toBe("0123456789");
    expect(formatNumber(29, "bn")).toBe("২৯");
    expect(formatNumber(29, "en-BD")).toBe("29");
  });

  it("provides month, weekday and category labels", () => {
    expect(getMonthName(3, "bn")).toBe("মার্চ");
    expect(getMonthName(12)).toBe("December");
    expect(getWeekdayName(5, "bn-BD")).toBe("শুক্রবার");
    expect(getWeekdayName(0)).toBe("Sunday");
    expect(getCategoryLabel("executive-order", "bn")).toBe("নির্বাহী আদেশে ছুটি");
    expect(getCategoryLabel("general")).toBe("General holiday");
    expect(getTypeLabel("religious", "bn")).toBe("ধর্মীয়");
    expect(getDateStatusLabel("tentative", "bn")).toBe("চাঁদ দেখার উপর নির্ভরশীল");
    expect(getCommunityLabel("ethnic-minority", "bn")).toBe("ক্ষুদ্র নৃ-গোষ্ঠী");
    expect(() => getMonthName(13)).toThrow(RangeError);
    expect(() => getWeekdayName(7)).toThrow(RangeError);
  });
});

describe("formatDate", () => {
  it("matches the style of the official notice", () => {
    expect(formatDate("2027-03-05", "bn-BD", { weekday: true })).toBe("শুক্রবার, ০৫ মার্চ ২০২৭");
    expect(formatDate("2027-12-25", "bn")).toBe("২৫ ডিসেম্বর ২০২৭");
  });

  it("formats English and alternative styles", () => {
    expect(formatDate("2027-03-05")).toBe("5 March 2027");
    expect(formatDate("2027-03-05", "en-BD", { weekday: true, padDay: true })).toBe("Friday, 05 March 2027");
    expect(formatDate("2027-03-05", "bn", { numerals: "latn", padDay: false })).toBe("5 মার্চ 2027");
    expect(formatDate(new Date(Date.UTC(2027, 2, 4, 20)), "en")).toBe("5 March 2027");
    expect(formatDate(new Date(Date.UTC(2027, 2, 4, 20)), "en", { dateInterpretation: "utc" })).toBe(
      "4 March 2027",
    );
  });
});

describe("revised Bangla calendar", () => {
  it.each([
    ["2027-04-14", "০১ বৈশাখ ১৪৩৪"],
    ["2027-02-21", "০৮ ফাল্গুন ১৪৩৩"],
    ["2027-03-26", "১২ চৈত্র ১৪৩৩"],
    ["2027-12-16", "০১ পৌষ ১৪৩৪"],
    ["2027-04-13", "৩০ চৈত্র ১৪৩৩"],
    ["2019-04-14", "০১ বৈশাখ ১৪২৬"],
  ])("%s → %s", (date, expected) => {
    expect(formatBengaliDate(date)).toBe(expected);
  });

  it("keeps national days on fixed Bangla dates in leap years", () => {
    // The 2019 revision aligns these dates every year.
    for (const year of [2028, 2029, 2032, 2100]) {
      expect(formatBengaliDate(`${year}-02-21`).split(" ").slice(0, 2).join(" ")).toBe("০৮ ফাল্গুন");
      expect(formatBengaliDate(`${year}-03-26`).split(" ").slice(0, 2).join(" ")).toBe("১২ চৈত্র");
      expect(formatBengaliDate(`${year}-12-16`).split(" ").slice(0, 2).join(" ")).toBe("০১ পৌষ");
    }
    expect(toBengaliDate("2028-02-29")).toMatchObject({ year: 1434, month: 11, day: 16 });
    expect(toBengaliDate("2028-03-14")).toMatchObject({ year: 1434, month: 11, day: 30 });
    expect(toBengaliDate("2027-03-14")).toMatchObject({ year: 1433, month: 11, day: 29 });
  });

  it("uses the revised month lengths", () => {
    expect(getBengaliMonthLengths(1433)).toEqual([31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 29, 30]);
    expect(getBengaliMonthLengths(1434)).toEqual([31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 30]);
    expect(getBengaliMonthLengths(1434).reduce((a, b) => a + b)).toBe(366);
  });

  it("round-trips every day for several years", () => {
    let date = "2019-04-14";
    for (let i = 0; i < 365 * 12; i++) {
      const bengali = toBengaliDate(date);
      expect(fromBengaliDate(bengali.year, bengali.month, bengali.day)).toBe(date);
      const next = new Date(`${date}T00:00:00Z`);
      next.setUTCDate(next.getUTCDate() + 1);
      date = next.toISOString().slice(0, 10);
    }
  });

  it("exposes names and English formatting", () => {
    const date = toBengaliDate("2027-03-26");
    expect(date).toMatchObject({
      year: 1433,
      month: 12,
      day: 12,
      monthNameBn: "চৈত্র",
      monthNameEn: "Choitro",
    });
    expect(date.formattedEn).toBe("12 Choitro 1433");
    expect(formatBengaliDate("2027-03-05", { locale: "en", padDay: false })).toBe("20 Falgun 1433");
    expect(BENGALI_MONTHS_BN).toHaveLength(12);
  });

  it("refuses dates outside the revised calendar instead of guessing", () => {
    expect(() => toBengaliDate("2019-04-13")).toThrow(/supports dates from 2019-04-14/);
    expect(() => fromBengaliDate(1425, 1, 1)).toThrow(RangeError);
    expect(() => fromBengaliDate(1433, 13, 1)).toThrow(RangeError);
    expect(() => fromBengaliDate(1433, 11, 30)).toThrow(/out of range/);
    expect(fromBengaliDate(1434, 11, 30)).toBe("2028-03-14");
  });
});
