import { describe, expect, it } from "vitest";
import { VERSION } from "../src";
import { runCli, type CliIO } from "../src/cli/run";

interface Result {
  code: number;
  out: string;
  err: string;
  files: Record<string, string>;
}

function cli(args: string, now = "2027-05-01T06:00:00Z"): Result {
  const result: Result = { code: -1, out: "", err: "", files: {} };
  const io: CliIO = {
    stdout: (text) => (result.out += text),
    stderr: (text) => (result.err += text),
    writeFile: (path, content) => (result.files[path] = content),
    now: () => new Date(now),
  };
  result.code = runCli(args.split(" ").filter(Boolean), io);
  return result;
}

describe("CLI basics", () => {
  it("prints help and version", () => {
    expect(cli("--help")).toMatchObject({ code: 0 });
    expect(cli("-h").out).toContain("Usage:");
    expect(cli("--version").out).toBe(`${VERSION}\n`);
    expect(cli("-v").code).toBe(0);
  });

  it("reports usage errors with exit code 2", () => {
    for (const args of [
      "--nope",
      "frobnicate",
      "2027 --locale fr",
      "2027 --format xml",
      "2027 --weekend xyz",
      "2027 --month march",
      "next --limit abc",
      "2027 --locale",
      "add 2027-03-04",
      "count 2027-03-01",
      "month 2027",
      "00000",
    ]) {
      const result = cli(args);
      expect(result.code, args).toBe(2);
      expect(result.err, args).toMatch(/^Error: /);
    }
  });

  it("reports runtime errors with exit code 1", () => {
    const missing = cli("2026");
    expect(missing.code).toBe(1);
    expect(missing.err).toContain("Available years: 2027");
    expect(cli("check 2027-02-30").code).toBe(1);
    expect(cli("count 2027-03-31 2027-03-01").code).toBe(1);
    expect(cli("2026 --ignore-missing")).toMatchObject({ code: 0, out: "No holidays.\n" });
  });
});

describe("list", () => {
  it("lists holidays as a table (default command and year)", () => {
    const result = cli("");
    expect(result.code).toBe(0);
    expect(result.out).toContain("Independence and National Day");
    expect(result.out).toContain("(General holiday)");
    expect(result.out).toContain("* subject to moon sighting");
    expect(cli("list 2027").out).toBe(result.out);
  });

  it("supports Bangla, month filter, optional and regional holidays", () => {
    const bn = cli("2027 --locale=bn");
    expect(bn.out).toContain("স্বাধীনতা ও জাতীয় দিবস");
    expect(bn.out).toContain("শুক্রবার, ২৬ মার্চ ২০২৭");
    expect(bn.out).toContain("* চাঁদ দেখার উপর নির্ভরশীল");
    const march = cli("2027 -m 3");
    expect(march.out).toContain("Jumatul Bida");
    expect(march.out).not.toContain("May Day");
    expect(cli("2027").out).not.toContain("Good Friday");
    expect(cli("2027 --optional").out).toContain("Good Friday");
    expect(cli("2027 --region rangamati").out).toContain("Chaitra Sankranti");
    expect(cli("2027 --month 12").out.trim().split("\n")).toHaveLength(2);
    expect(cli("2027 --weekend sat --ignore-missing").code).toBe(0);
  });

  it("exports JSON, CSV and ICS, to stdout or a file", () => {
    expect((JSON.parse(cli("2027 -f json").out) as { count: number }).count).toBe(23);
    expect(cli("2027 --format csv").out.startsWith("id,date,")).toBe(true);
    expect(cli("2027 --format csv --bom").out.charCodeAt(0)).toBe(0xfeff);
    const ics = cli("2027 --format ics --out holidays.ics");
    expect(ics.out).toBe("");
    expect(ics.err).toBe("Wrote holidays.ics\n");
    expect(ics.files["holidays.ics"]?.startsWith("BEGIN:VCALENDAR")).toBe(true);
  });
});

describe("date commands", () => {
  it("checks a date (default: today in Bangladesh)", () => {
    expect(cli("check 2027-03-26").out).toBe(
      "Friday, 26 March 2027: not a business day — Independence and National Day, weekend\n",
    );
    expect(cli("check", "2027-03-14T03:00:00Z").out).toBe("Sunday, 14 March 2027: business day\n");
    expect(cli("check 2027-03-10 -l bn").out).toContain("ছুটি — ঈদ-উল-ফিতর");
    expect(cli("check 2027-03-14 -l bn").out).toContain("কর্মদিবস");
  });

  it("lists upcoming holidays", () => {
    const next = cli("next 2", "2027-08-01T06:00:00Z");
    expect(next.out).toContain("July Mass Uprising Day");
    expect(next.out).toContain("Eid-e-Miladunnabi");
    expect(next.out).not.toContain("Janmashtami");
    expect(cli("next --limit 1", "2027-08-01T06:00:00Z").out).toBe(
      "Thursday, 5 August 2027  July Mass Uprising Day  (General holiday)\n",
    );
  });

  it("does business-day arithmetic", () => {
    expect(cli("add 2027-03-04 1").out).toBe("2027-03-14  (Sunday, 14 March 2027)\n");
    expect(cli("add 2027-03-14 -1").out.startsWith("2027-03-04")).toBe(true);
    expect(cli("count 2027-03-01 2027-03-31").out).toBe("18\n");
  });

  it("shows long weekends and leave suggestions", () => {
    expect(cli("long-weekends 2027").out).toContain("5 March 2027 – 13 March 2027  9 days");
    const leave = cli("leave 2027 --max-leave 1 --limit 2");
    expect(leave.out).toBe(
      "Take 4 March 2027 → 4 March 2027 – 13 March 2027: 10 days off (1 leave day)\n" +
        "Take 13 May 2027 → 13 May 2027 – 22 May 2027: 10 days off (1 leave day)\n",
    );
    expect(cli("leave 2027 --limit 1 -l bn").out).toContain("টানা ১০ দিন");
    expect(cli("leave 2027 --limit 0").out).toBe("No suggestions.\n");
    expect(cli("long-weekends 2026 --ignore-missing").out).toBe("No long weekends.\n");
    expect(cli("leave 2027 --max-leave 2 --limit 20").out).toContain("2 leave days");
  });

  it("draws a month grid", () => {
    const en = cli("month 2027 3");
    expect(en.out.startsWith("March 2027\nSun  Mon  Tue")).toBe(true);
    expect(en.out).toContain(" 5*");
    expect(en.out).toContain("* holiday   · weekend");
    expect(en.out).toContain("Independence and National Day");
    const bn = cli("month 2027 3 -l bn");
    expect(bn.out.startsWith("মার্চ ২০২৭\nর    সো")).toBe(true);
    expect(bn.out).toContain("১০*");
    expect(cli("month 2027 2 --weekend fri,sat").code).toBe(0);
  });

  it("prints Bangla calendar dates", () => {
    expect(cli("bangla 2027-03-26").out).toBe("Friday, 12 Choitro 1433 (Boshonto)\n");
    expect(cli("bangla 2027-03-26 -l bn").out).toBe("শুক্রবার, ১২ চৈত্র ১৪৩৩ (বসন্তকাল)\n");
    expect(cli("bangla", "2027-04-13T20:00:00Z").out).toBe(
      "Wednesday, 1 Boishakh 1434 (Grishma)\n".replace(" 1 ", " 01 "),
    );
  });
});
