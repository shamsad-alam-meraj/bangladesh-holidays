/**
 * Export holidays to JSON, CSV (Excel-friendly) and ICS (Google Calendar / Outlook / Apple Calendar).
 * Files are written to the OS temp directory.
 * Run: npm run build && node examples/calendar-export.ts
 */
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHolidayCalendar } from "bangladesh-holidays";

const calendar = createHolidayCalendar({ year: 2027, locale: "bn-BD" });

const files = {
  "bd-holidays-2027.json": calendar.export("json"),
  "bd-holidays-2027.csv": calendar.export("csv", { bom: true }),
  "bd-holidays-2027.ics": calendar.export("ics", {
    calendarName: "বাংলাদেশ সরকারি ছুটি ২০২৭",
    reminders: [{ minutesBefore: 24 * 60 }],
  }),
  "bd-holidays-2027-en.ics": calendar.export("ics", {
    locale: "en",
    calendarName: "Bangladesh Holidays 2027",
  }),
};

for (const [name, content] of Object.entries(files)) {
  const path = join(tmpdir(), name);
  writeFileSync(path, content, "utf8");
  console.log(`${path} (${content.length} chars)`);
}
