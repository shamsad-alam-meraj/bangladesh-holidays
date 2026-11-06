/**
 * An organisation-specific calendar: custom holidays, closures, recurring days,
 * working-day overrides, optional holidays and a moon-sighting update.
 * Run: npm run build && node examples/custom-calendar.ts
 */
import { createHolidayCalendar, type HolidayDatasetInput } from "bangladesh-holidays";

const calendar = createHolidayCalendar({
  year: 2027,
  locale: "en-BD",
  weekend: [5, 6],
  includeOptionalHolidays: false,
  customHolidays: [
    { date: "2027-06-01", name: "Company Foundation Day", nameBn: "কোম্পানি প্রতিষ্ঠা দিবস" },
    {
      id: "office-move",
      date: "2027-07-05",
      endDate: "2027-07-07",
      name: "Office relocation",
      type: "closure",
    },
    { date: "2027-09-30", name: "Quarter-end half day", dayType: "half" },
  ],
  recurringHolidays: [{ id: "sports-day", month: 1, day: 28, name: "Annual Sports Day" }],
  // Saturday 27 March is a make-up working day for this company.
  workingDayOverrides: ["2027-03-27"],
});

console.log(calendar.getHoliday("2027-06-01")?.name); // Company Foundation Day
console.log(calendar.isBusinessDay("2027-07-06")); // false (closure)
console.log(calendar.isBusinessDay("2027-03-27")); // true (override)
console.log(calendar.getDayInfo("2027-09-30").reason); // "half-day"

// Runtime updates return new calendars; the original is unchanged.
const updated = calendar
  .addCustomHolidays({ date: "2027-08-10", name: "Town hall offsite" })
  .excludeHolidays("sports-day");
console.log(calendar.isHoliday("2027-08-10"), updated.isHoliday("2027-08-10")); // false true

// After the moon-sighting committee's decision, move Eid-ul-Fitr if needed.
const confirmed = calendar.overrideHolidayDates({ id: "2027-eid-ul-fitr", date: "2027-03-10" });
console.log(confirmed.getHoliday("2027-03-10")?.dateStatus); // "confirmed"

// Load your own JSON dataset (validated on load).
const branchCalendar: HolidayDatasetInput = {
  schemaVersion: 1,
  calendar: "chattogram-branch",
  year: 2027,
  version: "1.0.0",
  status: "custom",
  lastUpdated: "2026-11-06",
  holidays: [
    {
      id: "ctg-2027-port-day",
      nameEn: "Port Day",
      date: "2027-04-25",
      category: "corporate",
      type: "company",
      dateStatus: "scheduled",
    },
  ],
};
const branch = createHolidayCalendar({ year: 2027, datasets: [branchCalendar] });
console.log(branch.options.calendars); // ["government", "chattogram-branch"]
console.log(branch.isBusinessDay("2027-04-25")); // false
