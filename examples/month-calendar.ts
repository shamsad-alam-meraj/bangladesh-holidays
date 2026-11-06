/**
 * Month grid data for calendar UIs (React, Vue, Svelte, server-rendered HTML, …).
 * Run: npm run build && node examples/month-calendar.ts
 */
import { getMonthCalendar, toBanglaDigits } from "bangladesh-holidays";

const march = getMonthCalendar(2027, 3, { locale: "bn", weekStartsOn: 6 });

console.log(
  `${march.monthName} ${toBanglaDigits(march.year)} — ${toBanglaDigits(march.businessDays)} কর্মদিবস`,
);
console.log(march.weekdays.map((d) => d.name).join(" | "));
for (const week of march.weeks) {
  console.log(
    week
      .map((day) => {
        if (!day.inMonth) return "  ·  ";
        const label = toBanglaDigits(String(day.day).padStart(2, "0"));
        return day.isHoliday ? `[${label}]` : day.isWeekend ? `(${label})` : ` ${label} `;
      })
      .join(" "),
  );
}

// What a UI component receives for one day:
const eid = march.weeks.flat().find((day) => day.date === "2027-03-10");
console.log(
  JSON.stringify({
    date: eid?.date,
    isHoliday: eid?.isHoliday,
    isBusinessDay: eid?.isBusinessDay,
    holiday: eid?.holidays[0]?.name,
    bengaliDate: eid?.bengaliDate,
  }),
);

/* A React component could render it like this:

export function MonthView({ year, month }: { year: number; month: number }) {
  const grid = getMonthCalendar(year, month, { locale: "bn" });
  return (
    <table>
      <thead><tr>{grid.weekdays.map((d) => <th key={d.weekday}>{d.name}</th>)}</tr></thead>
      <tbody>
        {grid.weeks.map((week, i) => (
          <tr key={i}>
            {week.map((day) => (
              <td key={day.date} className={day.isHoliday ? "holiday" : day.isWeekend ? "weekend" : ""}
                  title={day.holidays.map((h) => h.name).join(", ")}>
                {day.inMonth ? day.day : ""}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
*/
