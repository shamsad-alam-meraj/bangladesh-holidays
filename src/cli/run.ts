/**
 * Command-line interface. `runCli` is pure (all I/O goes through `io`) so it can be tested
 * without spawning processes; `src/cli/index.ts` wires it to the real process.
 */
import {
  ConfigurationError,
  HolidayDataUnavailableError,
  InvalidDateError,
  VERSION,
  createHolidayCalendar,
  formatBengaliDate,
  formatDate,
  getAvailableYears,
  getCategoryLabel,
  toBanglaDigits,
  todayInBangladesh,
  type CalendarOptions,
  type Holiday,
  type HolidayCalendar,
  type LocaleCode,
  type Weekday,
} from "bangladesh-holidays";

export interface CliIO {
  stdout(text: string): void;
  stderr(text: string): void;
  writeFile(path: string, content: string): void;
  /** Current time (injectable for tests). */
  now?(): Date;
}

/** Exit codes: 0 success, 1 runtime error (bad date, missing data), 2 usage error. */
export type ExitCode = 0 | 1 | 2;

class UsageError extends Error {}

const HELP = `bangladesh-holidays ${VERSION} — Bangladesh holidays and business days

Usage:
  bangladesh-holidays [list] [year]          List holidays (default: current year)
  bangladesh-holidays check [date]           Is a date a business day? (default: today)
  bangladesh-holidays next [count]           Upcoming holidays from today
  bangladesh-holidays add <date> <days>      Add (or subtract, if negative) business days
  bangladesh-holidays count <from> <to>      Count business days (both ends included)
  bangladesh-holidays long-weekends [year]   Runs of 3+ days off
  bangladesh-holidays leave [year]           Best days to take leave for long breaks
  bangladesh-holidays month <year> <month>   Month calendar grid
  bangladesh-holidays bangla [date]          Bangla calendar date, weekday and season

Options:
  -l, --locale <en|bn>       Language (default: en)
  -f, --format <fmt>         list: table | json | csv | ics (default: table)
  -o, --out <file>           Write output to a file (UTF-8) instead of stdout
      --bom                  CSV: add a byte-order mark for Excel
  -m, --month <1-12>         list: only this month
      --optional             Include optional holidays (all communities)
      --region <name>        Include regional holidays, e.g. rangamati (or "all")
      --weekend <days>       Weekly days off, e.g. fri,sat (default) or 5,6
      --max-leave <n>        leave: maximum leave days per suggestion (default 3)
      --limit <n>            next/leave: number of results
      --ignore-missing       Treat years without data as having no holidays
  -h, --help                 Show this help
  -v, --version              Show the version

Dates are YYYY-MM-DD. Examples:
  bangladesh-holidays 2027 --locale bn
  bangladesh-holidays 2027 --format ics --out holidays-2027.ics
  bangladesh-holidays add 2027-03-04 5
  bangladesh-holidays leave 2027 --max-leave 2
`;

const BOOLEAN_FLAGS = new Set(["optional", "bom", "ignore-missing", "help", "version"]);
const VALUE_FLAGS = new Set(["locale", "format", "out", "month", "region", "weekend", "max-leave", "limit"]);
const ALIASES: Record<string, string> = {
  l: "locale",
  f: "format",
  o: "out",
  m: "month",
  h: "help",
  v: "version",
};
const COMMANDS = new Set([
  "list",
  "check",
  "next",
  "add",
  "count",
  "long-weekends",
  "leave",
  "month",
  "bangla",
]);
const WEEKDAY_NAMES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const SHORT_WEEKDAYS_BN = ["র", "সো", "ম", "বু", "বৃ", "শু", "শ"];

interface Parsed {
  command: string;
  args: string[];
  flags: Map<string, string | true>;
}

function parse(argv: readonly string[]): Parsed {
  const flags = new Map<string, string | true>();
  const positional: string[] = [];
  for (let index = 0; index < argv.length; index++) {
    const token = argv[index] ?? "";
    if (token.startsWith("-") && token !== "-" && !/^-\d/.test(token)) {
      const body = token.replace(/^--?/, "");
      const [rawName, inlineValue] = body.split(/=(.*)/s, 2) as [string, string | undefined];
      const name = token.startsWith("--") ? rawName : (ALIASES[rawName] ?? rawName);
      if (BOOLEAN_FLAGS.has(name)) {
        flags.set(name, true);
      } else if (VALUE_FLAGS.has(name)) {
        const value = inlineValue ?? argv[++index];
        if (value === undefined) throw new UsageError(`Option --${name} needs a value`);
        flags.set(name, value);
      } else {
        throw new UsageError(`Unknown option ${token}`);
      }
    } else {
      positional.push(token);
    }
  }
  const first = positional[0];
  if (first !== undefined && COMMANDS.has(first)) return { command: first, args: positional.slice(1), flags };
  if (first !== undefined && !/^\d{4}$/.test(first)) throw new UsageError(`Unknown command "${first}"`);
  return { command: "list", args: positional, flags };
}

function flag(parsed: Parsed, name: string): string | undefined {
  const value = parsed.flags.get(name);
  return typeof value === "string" ? value : undefined;
}

function integer(value: string | undefined, label: string): number | undefined {
  if (value === undefined) return undefined;
  if (!/^-?\d+$/.test(value)) throw new UsageError(`${label} must be an integer, got "${value}"`);
  return Number(value);
}

function parseWeekend(value: string): Weekday[] {
  return value.split(",").map((part) => {
    const token = part.trim().toLowerCase();
    const index = /^\d$/.test(token) ? Number(token) : WEEKDAY_NAMES.indexOf(token.slice(0, 3));
    if (index < 0 || index > 6) throw new UsageError(`Invalid weekend day "${part}" (use sun..sat or 0..6)`);
    return index as Weekday;
  });
}

function calendarOptions(parsed: Parsed): CalendarOptions {
  const localeFlag = flag(parsed, "locale") ?? "en";
  const locale: LocaleCode | undefined =
    localeFlag === "bn" || localeFlag === "bn-BD" || localeFlag === "en" || localeFlag === "en-BD"
      ? localeFlag
      : undefined;
  if (!locale) throw new UsageError(`--locale must be en or bn, got "${localeFlag}"`);
  const weekend = flag(parsed, "weekend");
  const region = flag(parsed, "region");
  return {
    locale,
    ...(weekend !== undefined ? { weekend: parseWeekend(weekend) } : {}),
    ...(region !== undefined ? { region } : {}),
    ...(parsed.flags.has("optional") ? { includeOptionalHolidays: true } : {}),
    ...(parsed.flags.has("ignore-missing") ? { onMissingData: "ignore" as const } : {}),
  };
}

function isBangla(calendar: HolidayCalendar): boolean {
  return calendar.options.locale.startsWith("bn");
}

function dateRange(holiday: Holiday, locale: LocaleCode): string {
  const start = formatDate(holiday.date, locale, { weekday: true });
  return holiday.endDate ? `${start} – ${formatDate(holiday.endDate, locale, { weekday: true })}` : start;
}

function holidayTable(holidays: readonly Holiday[], locale: LocaleCode): string {
  if (holidays.length === 0) return "No holidays.\n";
  const rows = holidays.map((holiday) => [
    dateRange(holiday, locale),
    `${holiday.name}${holiday.dateStatus === "tentative" ? " *" : ""}`,
    getCategoryLabel(holiday.category, locale),
  ]);
  const width = Math.max(...rows.map((row) => [...(row[0] ?? "")].length));
  const lines = rows.map(([date = "", name = "", category = ""]) => {
    return `${date}${" ".repeat(width - [...date].length)}  ${name}  (${category})`;
  });
  const tentative = holidays.some((holiday) => holiday.dateStatus === "tentative");
  const note = tentative
    ? locale.startsWith("bn")
      ? "\n* চাঁদ দেখার উপর নির্ভরশীল\n"
      : "\n* subject to moon sighting\n"
    : "";
  return `${lines.join("\n")}\n${note}`;
}

function resolveDate(value: string | undefined, io: CliIO): string {
  return value ?? todayInBangladesh(io.now?.() ?? new Date());
}

function currentYear(io: CliIO): number {
  return Number(todayInBangladesh(io.now?.() ?? new Date()).slice(0, 4));
}

function yearArg(value: string | undefined, io: CliIO): number {
  const year = integer(value, "year") ?? currentYear(io);
  if (year < 1 || year > 9999) throw new UsageError(`Invalid year ${year}`);
  return year;
}

function execute(parsed: Parsed, io: CliIO): string {
  const calendar = createHolidayCalendar(calendarOptions(parsed));
  const locale = calendar.options.locale;
  const bn = isBangla(calendar);
  const [first, second] = parsed.args;

  switch (parsed.command) {
    case "list": {
      const year = yearArg(first, io);
      const month = integer(flag(parsed, "month"), "--month");
      const format = flag(parsed, "format") ?? "table";
      const holidays = calendar.getHolidays(month === undefined ? { year } : { year, month });
      switch (format) {
        case "table":
          return holidayTable(holidays, locale);
        case "json":
          return `${calendar.export("json", { year })}\n`;
        case "csv":
          return calendar.export("csv", { year, bom: parsed.flags.has("bom") });
        case "ics":
          return calendar.export("ics", { year });
        default:
          throw new UsageError(`--format must be table, json, csv or ics, got "${format}"`);
      }
    }
    case "check": {
      const info = calendar.getDayInfo(resolveDate(first, io));
      const date = formatDate(info.date, locale, { weekday: true });
      const status = info.isBusinessDay
        ? bn
          ? "কর্মদিবস"
          : "business day"
        : bn
          ? "ছুটি"
          : "not a business day";
      const reasons = info.holidays.map((holiday) => holiday.name);
      if (info.isWeekend && !info.isWorkingDayOverride) reasons.push(bn ? "সাপ্তাহিক ছুটি" : "weekend");
      return `${date}: ${status}${reasons.length ? ` — ${reasons.join(", ")}` : ""}\n`;
    }
    case "next": {
      const limit = integer(first, "count") ?? integer(flag(parsed, "limit"), "--limit") ?? 5;
      return holidayTable(calendar.getUpcomingHolidays(resolveDate(undefined, io), { limit }), locale);
    }
    case "add": {
      if (first === undefined || second === undefined) throw new UsageError("Usage: add <date> <days>");
      const days = integer(second, "days") ?? 0;
      const result = calendar.addBusinessDays(first, days);
      return `${result}  (${formatDate(result, locale, { weekday: true })})\n`;
    }
    case "count": {
      if (first === undefined || second === undefined) throw new UsageError("Usage: count <from> <to>");
      return `${calendar.countBusinessDays(first, second)}\n`;
    }
    case "long-weekends": {
      const runs = calendar.getLongWeekends(yearArg(first, io));
      if (runs.length === 0) return "No long weekends.\n";
      return `${runs
        .map(
          (run) =>
            `${formatDate(run.startDate, locale)} – ${formatDate(run.endDate, locale)}  ${run.days} ${bn ? "দিন" : "days"}  ${run.holidays.map((h) => h.name).join(", ")}`,
        )
        .join("\n")}\n`;
    }
    case "leave": {
      const maxLeaveDays = integer(flag(parsed, "max-leave"), "--max-leave") ?? 3;
      const limit = integer(flag(parsed, "limit"), "--limit") ?? 10;
      const plans = calendar.suggestLeave(yearArg(first, io), { maxLeaveDays, limit });
      if (plans.length === 0) return "No suggestions.\n";
      return `${plans
        .map((plan) => {
          const take = plan.leaveDates.map((date) => formatDate(date, locale)).join(", ");
          const range = `${formatDate(plan.startDate, locale)} – ${formatDate(plan.endDate, locale)}`;
          return bn
            ? `${take} ছুটি নিলে → ${range}: টানা ${toBanglaDigits(plan.daysOff)} দিন (${toBanglaDigits(plan.leaveDays)} দিনের ছুটিতে)`
            : `Take ${take} → ${range}: ${plan.daysOff} days off (${plan.leaveDays} leave day${plan.leaveDays > 1 ? "s" : ""})`;
        })
        .join("\n")}\n`;
    }
    case "month": {
      const year = integer(first, "year");
      const month = integer(second, "month");
      if (year === undefined || month === undefined) throw new UsageError("Usage: month <year> <month>");
      const grid = calendar.getMonthCalendar(year, month, { bengaliDates: false });
      const header = grid.weekdays
        .map((day) => (bn ? (SHORT_WEEKDAYS_BN[day.weekday] ?? "") : day.name.slice(0, 3)).padEnd(5))
        .join("");
      const rows = grid.weeks.map((week) =>
        week
          .map((day) => {
            if (!day.inMonth) return "     ";
            const label = String(day.day).padStart(2);
            const marker = day.isHoliday ? "*" : day.isWeekend ? "·" : " ";
            return `${bn ? toBanglaDigits(label) : label}${marker}  `;
          })
          .join("")
          .trimEnd(),
      );
      const legend = grid.holidays.map((holiday) => `  ${formatDate(holiday.date, locale)}  ${holiday.name}`);
      const title = `${grid.monthName} ${bn ? toBanglaDigits(year) : year}`;
      const key = bn ? "* ছুটি   · সাপ্তাহিক ছুটি" : "* holiday   · weekend";
      return `${title}\n${header.trimEnd()}\n${rows.join("\n")}\n${key}\n${legend.length ? `\n${legend.join("\n")}\n` : ""}`;
    }
    case "bangla": {
      const date = resolveDate(first, io);
      return `${formatBengaliDate(date, { locale: bn ? "bn" : "en", weekday: true, season: true })}\n`;
    }
    default:
      throw new UsageError(`Unknown command "${parsed.command}"`);
  }
}

/** Run the CLI with the given arguments (without the node/script prefix). */
export function runCli(argv: readonly string[], io: CliIO): ExitCode {
  let parsed: Parsed;
  try {
    parsed = parse(argv);
    if (parsed.flags.has("help")) {
      io.stdout(HELP);
      return 0;
    }
    if (parsed.flags.has("version")) {
      io.stdout(`${VERSION}\n`);
      return 0;
    }
    const output = execute(parsed, io);
    const out = flag(parsed, "out");
    if (out !== undefined) {
      io.writeFile(out, output);
      io.stderr(`Wrote ${out}\n`);
    } else {
      io.stdout(output);
    }
    return 0;
  } catch (error) {
    if (error instanceof UsageError) {
      io.stderr(`Error: ${error.message}\nRun "bangladesh-holidays --help" for usage.\n`);
      return 2;
    }
    if (error instanceof HolidayDataUnavailableError) {
      io.stderr(
        `Error: no ${error.calendar} holiday data for ${error.year}. Available years: ${getAvailableYears().join(", ")}.\n` +
          `Use --ignore-missing to treat ${error.year} as having no holidays.\n`,
      );
      return 1;
    }
    if (
      error instanceof InvalidDateError ||
      error instanceof ConfigurationError ||
      error instanceof RangeError
    ) {
      io.stderr(`Error: ${error.message}\n`);
      return 1;
    }
    throw error;
  }
}
