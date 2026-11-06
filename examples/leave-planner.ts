/**
 * Leave planner: which days to take off for the longest breaks.
 * Run: npm run build && node examples/leave-planner.ts
 */
import { createHolidayCalendar, formatDate, suggestLeave, toBanglaDigits } from "bangladesh-holidays";

// Best plans with up to 2 leave days each.
for (const plan of suggestLeave(2027, { maxLeaveDays: 2, limit: 5 })) {
  const take = plan.leaveDates.map((date) => formatDate(date, "en")).join(" + ");
  console.log(
    `Take ${take} → ${plan.daysOff} days off (${plan.startDate} – ${plan.endDate}), ` +
      `${plan.efficiency.toFixed(1)} days per leave day: ${plan.holidays[0]?.name ?? ""}`,
  );
}

// A Hindu employee's calendar (optional holidays included) and a six-day factory week.
const employee = createHolidayCalendar({
  year: 2027,
  includeOptionalHolidays: true,
  optionalHolidayCommunities: ["hindu"],
});
const durgaPuja = employee
  .suggestLeave(2027, { limit: 20 })
  .find((plan) => plan.startDate.startsWith("2027-10"));
console.log(`Durga Puja: take ${durgaPuja?.leaveDates.join(", ")} → ${durgaPuja?.daysOff} days off`);

const factory = createHolidayCalendar({ year: 2027, weekend: [5] });
console.log(`Factory best plan: ${factory.suggestLeave(2027, { limit: 1 })[0]?.daysOff} days off`);

// In Bangla
for (const plan of suggestLeave(2027, { limit: 2, locale: "bn" })) {
  console.log(
    `${plan.leaveDates.map((d) => formatDate(d, "bn")).join(", ")} ছুটি নিলে টানা ${toBanglaDigits(plan.daysOff)} দিন`,
  );
}
