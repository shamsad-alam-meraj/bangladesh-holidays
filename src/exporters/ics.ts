/**
 * iCalendar (RFC 5545) export. Produces all-day events with exclusive DTEND,
 * CRLF line endings and UTF-8-safe 75-octet line folding, which Google Calendar,
 * Outlook and Apple Calendar import correctly.
 */
import { addDays } from "../core/date-utils";
import { getCategoryLabel, getDateStatusLabel, getTypeLabel } from "../localization";
import { VERSION } from "../version";
import type { Holiday, LocaleCode } from "../types/holiday";
import type { IcsExportOptions, IcsReminder } from "../types/export";

/** Escape a TEXT value (RFC 5545 §3.3.11). */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

function utf8Length(codePoint: number): number {
  if (codePoint < 0x80) return 1;
  if (codePoint < 0x800) return 2;
  if (codePoint < 0x10000) return 3;
  return 4;
}

/** Fold a content line to at most 75 octets per physical line (RFC 5545 §3.1). */
export function foldIcsLine(line: string): string {
  const parts: string[] = [];
  let current = "";
  let octets = 0;
  let limit = 75;
  for (const char of line) {
    const size = utf8Length(char.codePointAt(0) ?? 0);
    if (octets + size > limit) {
      parts.push(current);
      current = "";
      octets = 0;
      limit = 74; // continuation lines start with one space
    }
    current += char;
    octets += size;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

function compactDate(iso: string): string {
  return iso.replace(/-/g, "");
}

function timestamp(date: Date): string {
  return `${date.toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`;
}

function trigger(reminder: IcsReminder): string {
  const minutes = reminder.minutesBefore;
  if (!Number.isInteger(minutes) || minutes < 0) {
    throw new RangeError("reminder minutesBefore must be a non-negative integer");
  }
  if (minutes === 0) return "PT0M";
  if (minutes % 1440 === 0) return `-P${minutes / 1440}D`;
  if (minutes % 60 === 0) return `-PT${minutes / 60}H`;
  return `-PT${minutes}M`;
}

function eventLines(
  holiday: Holiday,
  locale: LocaleCode,
  stamp: string,
  options: IcsExportOptions,
): string[] {
  const domain = options.uidDomain ?? "bangladesh-holidays";
  const description = [
    holiday.description,
    `${getCategoryLabel(holiday.category, locale)} · ${getTypeLabel(holiday.type, locale)}`,
    holiday.dateStatus === "scheduled" ? undefined : getDateStatusLabel(holiday.dateStatus, locale),
    holiday.source?.reference ? `Ref: ${holiday.source.reference}` : undefined,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
  const lines = [
    "BEGIN:VEVENT",
    `UID:${holiday.id}@${domain}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${compactDate(holiday.date)}`,
    `DTEND;VALUE=DATE:${compactDate(addDays(holiday.endDate ?? holiday.date, 1))}`,
    `SUMMARY:${escapeIcsText(holiday.name)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    `CATEGORIES:${[getCategoryLabel(holiday.category, locale), getTypeLabel(holiday.type, locale)]
      .map(escapeIcsText)
      .join(",")}`,
    `STATUS:${holiday.dateStatus === "tentative" || holiday.dateStatus === "estimated" ? "TENTATIVE" : "CONFIRMED"}`,
    "CLASS:PUBLIC",
    `TRANSP:${options.busy ? "OPAQUE" : "TRANSPARENT"}`,
    "X-MICROSOFT-CDO-ALLDAYEVENT:TRUE",
    `X-MICROSOFT-CDO-BUSYSTATUS:${options.busy ? "OOF" : "FREE"}`,
  ];
  if (holiday.source?.url) lines.push(`URL:${holiday.source.url}`);
  for (const reminder of options.reminders ?? []) {
    lines.push(
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `TRIGGER:${trigger(reminder)}`,
      `DESCRIPTION:${escapeIcsText(reminder.description ?? holiday.name)}`,
      "END:VALARM",
    );
  }
  lines.push("END:VEVENT");
  return lines;
}

/** Serialize holidays as an iCalendar (`.ics`) document. */
export function exportToIcs(holidays: readonly Holiday[], options: IcsExportOptions = {}): string {
  const now = options.timestamp ?? new Date();
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new RangeError("timestamp must be a valid Date");
  }
  const stamp = timestamp(now);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//bangladesh-holidays//bangladesh-holidays ${VERSION}//EN`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(options.calendarName ?? "Bangladesh Holidays")}`,
    "X-WR-TIMEZONE:Asia/Dhaka",
  ];
  for (const holiday of holidays) {
    lines.push(...eventLines(holiday, options.locale ?? holiday.locale, stamp, options));
  }
  lines.push("END:VCALENDAR");
  return `${lines.map(foldIcsLine).join("\r\n")}\r\n`;
}
