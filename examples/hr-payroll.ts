/**
 * HR and payroll patterns: leave counting, payday, optional-holiday selection.
 * Run: npm run build && node examples/hr-payroll.ts
 */
import { createHolidayCalendar } from "bangladesh-holidays";

const calendar = createHolidayCalendar({ year: 2027 });

/** Working days charged for a leave application (weekends and public holidays excluded). */
function leaveDays(from: string, to: string): number {
  return calendar.countBusinessDays(from, to);
}

/** Salary is paid on the last business day of the month. */
function payday(year: number, month: number): string {
  const days = calendar.getWorkingDays(year, month);
  const last = days[days.length - 1];
  if (last === undefined) throw new Error(`No working days in ${year}-${month}`);
  return last;
}

console.log(leaveDays("2027-03-07", "2027-03-18")); // 5
for (let month = 1; month <= 12; month++) console.log(`Payday ${month}: ${payday(2027, month)}`);

// An employee may take up to 3 optional days a year according to their own religion.
const optionalForHinduStaff = calendar
  .with({ includeOptionalHolidays: true, optionalHolidayCommunities: ["hindu"] })
  .getHolidays({ category: "optional" });
console.log(optionalForHinduStaff.map((h) => `${h.date} ${h.name} (${h.durationDays}d)`));

// Monthly attendance sheet denominator.
for (let month = 1; month <= 12; month++) {
  console.log(`${month}: ${calendar.getWorkingDays(2027, month).length} working days`);
}
