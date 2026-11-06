/**
 * Business-day calculations.
 * Run: npm run build && node examples/working-days.ts
 */
import {
  addBusinessDays,
  countBusinessDays,
  createHolidayCalendar,
  getLongWeekends,
  getNextBusinessDay,
  getWorkingDays,
  isBusinessDay,
  subtractBusinessDays,
} from "bangladesh-holidays";

console.log(isBusinessDay("2027-03-14")); // true
console.log(addBusinessDays("2027-03-04", 1)); // 2027-03-14 (skips the Eid-ul-Fitr break)
console.log(subtractBusinessDays("2027-03-14", 1)); // 2027-03-04
console.log(getNextBusinessDay("2027-12-15")); // 2027-12-19
console.log(countBusinessDays("2027-03-01", "2027-03-31")); // 18 (both ends included)
console.log(countBusinessDays("2027-03-14", "2027-03-18", { includeEnd: false })); // 4
console.log(getWorkingDays(2027, 3).length); // 18

for (const run of getLongWeekends(2027)) {
  console.log(
    `${run.startDate} → ${run.endDate}: ${run.days} days (${run.holidays.map((h) => h.name).join(", ")})`,
  );
}

// A factory with a one-day (Friday) weekend.
const factory = createHolidayCalendar({ weekend: [5] });
console.log(factory.addBusinessDays("2027-05-13", 3)); // 2027-05-24
