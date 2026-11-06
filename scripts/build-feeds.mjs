/**
 * Builds the public calendar feeds deployed to GitHub Pages:
 *   site/bangladesh-holidays.ics        government holidays (English)
 *   site/bangladesh-holidays-bn.ics     government holidays (Bangla)
 *   site/bangladesh-holidays-all.ics    + optional holidays and regional holidays (English)
 *   site/bangladesh-holidays-all-bn.ics + optional holidays and regional holidays (Bangla)
 *   site/holidays.json, site/holidays.csv, site/index.html
 * Covers every year with bundled government data. Run `npm run build` first.
 * Fails (non-zero exit) if any feed is malformed, so a broken feed is never deployed.
 */
import { Buffer } from "node:buffer";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const distEntry = join(root, "dist", "index.js");
if (!existsSync(distEntry)) {
  console.error("dist/ not found — run `npm run build` first.");
  process.exit(1);
}
const bh = await import(new URL("../dist/index.js", import.meta.url).href);

const SITE_URL = process.env.FEEDS_BASE_URL ?? "https://shamsad-alam-meraj.github.io/bangladesh-holidays";
const out = join(root, "site");
const years = bh.getAvailableYears();
if (years.length === 0) throw new Error("No bundled government data");
const from = `${years[0]}-01-01`;
const to = `${years[years.length - 1]}-12-31`;
const now = new Date();

const feeds = [
  {
    file: "bangladesh-holidays.ics",
    title: "Government holidays (English)",
    options: { locale: "en" },
    name: "Bangladesh Holidays",
    description: "Bangladesh government holidays (general and executive-order).",
  },
  {
    file: "bangladesh-holidays-bn.ics",
    title: "সরকারি ছুটি (বাংলা)",
    options: { locale: "bn" },
    name: "বাংলাদেশের সরকারি ছুটি",
    description: "বাংলাদেশের সরকারি ছুটি (সাধারণ ও নির্বাহী আদেশে ছুটি)।",
  },
  {
    file: "bangladesh-holidays-all.ics",
    title: "All holidays incl. optional (English)",
    options: { locale: "en", includeOptionalHolidays: true, region: "all" },
    name: "Bangladesh Holidays (all)",
    description: "Bangladesh government holidays including optional holidays and hill-district holidays.",
  },
  {
    file: "bangladesh-holidays-all-bn.ics",
    title: "সকল ছুটি, ঐচ্ছিকসহ (বাংলা)",
    options: { locale: "bn", includeOptionalHolidays: true, region: "all" },
    name: "বাংলাদেশের সকল ছুটি",
    description: "সাধারণ, নির্বাহী আদেশে ও ঐচ্ছিক ছুটি।",
  },
];

function assertValidIcs(file, ics, expectedEvents) {
  const lines = ics.split("\r\n");
  const problems = [];
  if (!ics.startsWith("BEGIN:VCALENDAR\r\n") || !ics.endsWith("END:VCALENDAR\r\n")) problems.push("envelope");
  if (/[^\r]\n/.test(ics)) problems.push("bare LF line ending");
  const begins = lines.filter((line) => line === "BEGIN:VEVENT").length;
  const ends = lines.filter((line) => line === "END:VEVENT").length;
  if (begins !== ends || begins !== expectedEvents)
    problems.push(`events ${begins}/${ends}/${expectedEvents}`);
  if (lines.some((line) => Buffer.byteLength(line, "utf8") > 75)) problems.push("unfolded line > 75 octets");
  if (problems.length) throw new Error(`${file} is malformed: ${problems.join(", ")}`);
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const summaries = [];
for (const feed of feeds) {
  const calendar = bh.createHolidayCalendar(feed.options);
  const holidays = calendar.getHolidays({ from, to });
  const ics = calendar.export("ics", {
    from,
    to,
    calendarName: feed.name,
    calendarDescription: `${feed.description} ${SITE_URL}/`,
    refreshIntervalHours: 24,
    timestamp: now,
  });
  assertValidIcs(feed.file, ics, holidays.length);
  writeFileSync(join(out, feed.file), ics, "utf8");
  summaries.push({ ...feed, events: holidays.length });
}

const all = bh.createHolidayCalendar({ includeOptionalHolidays: true, region: "all" });
writeFileSync(join(out, "holidays.json"), all.export("json", { from, to }), "utf8");
writeFileSync(join(out, "holidays.csv"), all.export("csv", { from, to, bom: true }), "utf8");
writeFileSync(join(out, ".nojekyll"), "", "utf8");

const escapeHtml = (text) =>
  String(text).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const host = SITE_URL.replace(/^https?:\/\//, "");
const rows = summaries
  .map(
    (feed) => `      <tr>
        <td>${escapeHtml(feed.title)}</td>
        <td><a href="webcal://${escapeHtml(host)}/${feed.file}">Subscribe</a></td>
        <td><a href="${escapeHtml(SITE_URL)}/${feed.file}">Download</a></td>
        <td>${feed.events}</td>
      </tr>`,
  )
  .join("\n");
const coverage = bh
  .getDataCoverage()
  .filter((entry) => years.includes(entry.year))
  .map(
    (entry) =>
      `<li><strong>${escapeHtml(entry.calendar)} ${entry.year}</strong>: ${escapeHtml(entry.status)}${entry.reason ? ` — ${escapeHtml(entry.reason)}` : ""}</li>`,
  )
  .join("\n        ");
const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Bangladesh Holiday Calendar Feeds</title>
  <meta name="description" content="Subscribe to Bangladesh government holidays in Google Calendar, Outlook or Apple Calendar.">
  <style>
    :root { color-scheme: light dark; --fg: #1f2328; --muted: #59636e; --bg: #ffffff; --line: #d1d9e0; --accent: #006a4e; }
    @media (prefers-color-scheme: dark) { :root { --fg: #e6edf3; --muted: #9198a1; --bg: #0d1117; --line: #3d444d; --accent: #3fb950; } }
    body { font: 16px/1.6 system-ui, sans-serif; color: var(--fg); background: var(--bg); max-width: 760px; margin: 0 auto; padding: 32px 16px; }
    h1 { font-size: 1.6rem; margin: 0 0 4px; } p.lead { color: var(--muted); margin-top: 0; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; } th, td { text-align: left; padding: 8px; border-bottom: 1px solid var(--line); }
    a { color: var(--accent); } code { font-size: .9em; } .muted { color: var(--muted); font-size: .9rem; }
  </style>
</head>
<body>
  <h1>Bangladesh Holiday Calendar Feeds</h1>
  <p class="lead">Official Bangladesh government holidays (${years.join(", ")}) for Google Calendar, Outlook and Apple Calendar. Subscribed calendars update automatically, including moon-sighting changes.</p>
  <table>
    <thead><tr><th>Calendar</th><th>Subscribe</th><th>File</th><th>Events</th></tr></thead>
    <tbody>
${rows}
    </tbody>
  </table>
  <h2>How to subscribe</h2>
  <ul>
    <li><strong>Google Calendar:</strong> Settings → Add calendar → From URL → paste a feed URL, e.g. <code>${escapeHtml(SITE_URL)}/bangladesh-holidays.ics</code></li>
    <li><strong>Outlook:</strong> Add calendar → Subscribe from web → paste the URL.</li>
    <li><strong>Apple Calendar / iPhone:</strong> click “Subscribe” above.</li>
  </ul>
  <h2>Data</h2>
  <ul>
        ${coverage}
  </ul>
  <p>Also available as <a href="holidays.json">JSON</a> and <a href="holidays.csv">CSV</a>, and as the npm package <a href="https://www.npmjs.com/package/bangladesh-holidays"><code>bangladesh-holidays</code></a> (<a href="https://github.com/shamsad-alam-meraj/bangladesh-holidays">source</a>).</p>
  <p class="muted">Dates marked tentative depend on moon sighting. The official government notification is authoritative. Last built ${escapeHtml(now.toISOString().slice(0, 10))} with bangladesh-holidays ${escapeHtml(bh.VERSION)}.</p>
</body>
</html>
`;
writeFileSync(join(out, "index.html"), html, "utf8");

for (const feed of summaries) console.log(`✓ site/${feed.file} (${feed.events} events)`);
console.log("✓ site/holidays.json, site/holidays.csv, site/index.html");
