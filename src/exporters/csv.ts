import { getCategoryLabel, getDateStatusLabel } from "../localization";
import type { Holiday, LocaleCode } from "../types/holiday";
import type { CsvExportOptions } from "../types/export";

export const CSV_COLUMNS = [
  "id",
  "date",
  "endDate",
  "durationDays",
  "name",
  "nameEn",
  "nameBn",
  "category",
  "categoryLabel",
  "type",
  "calendar",
  "dateStatus",
  "dateStatusLabel",
  "dayType",
  "official",
  "verification",
  "communities",
  "regionsInclude",
  "regionsExclude",
  "description",
  "sourceReference",
  "sourceUrl",
  "announcementDate",
] as const;

const FORMULA_START = /^[=+\-@\t\r]/;

function cell(value: string | number | boolean, delimiter: string, escapeFormulas: boolean): string {
  let text = String(value);
  if (escapeFormulas && FORMULA_START.test(text)) text = `'${text}`;
  return /["\r\n]/.test(text) || text.includes(delimiter) ? `"${text.replace(/"/g, '""')}"` : text;
}

function row(holiday: Holiday, locale: LocaleCode): (string | number | boolean)[] {
  return [
    holiday.id,
    holiday.date,
    holiday.endDate ?? holiday.date,
    holiday.durationDays,
    holiday.name,
    holiday.nameEn,
    holiday.nameBn ?? "",
    holiday.category,
    getCategoryLabel(holiday.category, locale),
    holiday.type,
    holiday.calendar,
    holiday.dateStatus,
    getDateStatusLabel(holiday.dateStatus, locale),
    holiday.dayType,
    holiday.official,
    holiday.verification,
    (holiday.communities ?? []).join("|"),
    (holiday.regions?.include ?? []).join("|"),
    (holiday.regions?.exclude ?? []).join("|"),
    holiday.description ?? "",
    holiday.source?.reference ?? "",
    holiday.source?.url ?? "",
    holiday.announcementDate ?? "",
  ];
}

/** RFC 4180 CSV (CRLF line endings, header row). */
export function exportToCsv(
  holidays: readonly Holiday[],
  options: Pick<CsvExportOptions, "bom" | "delimiter" | "escapeFormulas" | "locale"> = {},
): string {
  const delimiter = options.delimiter ?? ",";
  const escapeFormulas = options.escapeFormulas ?? true;
  const lines = [CSV_COLUMNS.join(delimiter)];
  for (const holiday of holidays) {
    const locale = options.locale ?? holiday.locale;
    lines.push(
      row(holiday, locale)
        .map((value) => cell(value, delimiter, escapeFormulas))
        .join(delimiter),
    );
  }
  return `${options.bom ? String.fromCharCode(0xfeff) : ""}${lines.join("\r\n")}\r\n`;
}
