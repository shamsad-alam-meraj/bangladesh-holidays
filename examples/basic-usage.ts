/**
 * Basic usage: list holidays, look up dates, check data status.
 * Run: npm run build && node examples/basic-usage.ts
 */
import {
  getDataCoverage,
  getHoliday,
  getHolidays,
  getHolidaysByType,
  getHolidayStatistics,
  getNextHoliday,
  isHoliday,
} from "bangladesh-holidays";

// All general + executive-order holidays in 2027 (national scope).
for (const holiday of getHolidays(2027)) {
  const range = holiday.endDate ? `${holiday.date} → ${holiday.endDate}` : holiday.date;
  const flag = holiday.dateStatus === "tentative" ? " (subject to moon sighting)" : "";
  console.log(`${range.padEnd(25)} ${holiday.category.padEnd(16)} ${holiday.name}${flag}`);
}

console.log(isHoliday("2027-03-26")); // true
console.log(getHoliday("2027-03-26")?.name); // "Independence and National Day"
console.log(getNextHoliday("2027-06-01")?.name); // "Ashura"
console.log(getHolidaysByType(2027, "national").length); // 6

const stats = getHolidayStatistics(2027, { region: "all" });
console.log(
  `${stats.totalHolidayDays} holiday days, ${stats.uniqueNonWeekendHolidayDates} extra weekdays off`,
);

// Data availability is explicit — Bangladesh Bank 2027 data is not yet published.
for (const entry of getDataCoverage({ year: 2027 })) {
  console.log(`${entry.calendar}: ${entry.status}${entry.reason ? ` — ${entry.reason}` : ""}`);
}
