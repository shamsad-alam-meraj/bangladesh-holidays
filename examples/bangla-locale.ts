/**
 * Bangla localization: names, descriptions, numerals, dates and the Bangla calendar.
 * Run: npm run build && node examples/bangla-locale.ts
 */
import {
  createHolidayCalendar,
  formatBengaliDate,
  formatDate,
  getCategoryLabel,
  getHoliday,
  toBanglaDigits,
  toBengaliDate,
} from "bangladesh-holidays";

const holiday = getHoliday("2027-03-26", { locale: "bn-BD" });
console.log(holiday?.name); // স্বাধীনতা ও জাতীয় দিবস
console.log(holiday?.description); // ১৯৭১ সালে বাংলাদেশের স্বাধীনতা ঘোষণার বার্ষিকী।

console.log(formatDate("2027-03-26", "bn-BD", { weekday: true })); // শুক্রবার, ২৬ মার্চ ২০২৭
console.log(formatBengaliDate("2027-03-26")); // ১২ চৈত্র ১৪৩৩
console.log(toBengaliDate("2027-04-14").formattedEn); // 1 Boishakh 1434
console.log(toBanglaDigits(2027)); // ২০২৭

const calendar = createHolidayCalendar({ year: 2027, locale: "bn" });
for (const item of calendar.getHolidays({ month: 12 })) {
  console.log(
    `${formatDate(item.date, "bn", { weekday: true })} (${formatBengaliDate(item.date)}) — ${item.name} · ${getCategoryLabel(item.category, "bn")}`,
  );
}
