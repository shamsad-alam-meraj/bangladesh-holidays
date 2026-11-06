/**
 * Runs every example against the built package (examples import "bangladesh-holidays",
 * which resolves to ./dist through the package's own "exports") and checks key output.
 * Requires Node.js with TypeScript type stripping (22.6+). Run `npm run build` first.
 */
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
if (!existsSync(join(root, "dist", "index.js"))) {
  console.error("dist/ not found — run `npm run build` first.");
  process.exit(1);
}

const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 22 || (major === 22 && minor < 6)) {
  console.log(
    `Skipping examples: Node ${process.versions.node} cannot run TypeScript directly (needs 22.6+).`,
  );
  process.exit(0);
}
const flags = process.features?.typescript ? [] : ["--experimental-strip-types"];

/** Output each example must contain. */
const expectations = {
  "basic-usage.ts": [
    "Independence and National Day",
    "bank: unavailable",
    "29 holiday days, 21 extra weekdays off",
  ],
  "custom-calendar.ts": ["Company Foundation Day", "half-day", "false true", "confirmed"],
  "bangla-locale.ts": [
    "স্বাধীনতা ও জাতীয় দিবস",
    "শুক্রবার, ২৬ মার্চ ২০২৭",
    "১২ চৈত্র ১৪৩৩",
    "1 Boishakh 1434",
  ],
  "working-days.ts": ["2027-03-14", "2027-03-05 → 2027-03-13: 9 days", "2027-05-24"],
  "calendar-export.ts": ["bd-holidays-2027.ics"],
  "hr-payroll.ts": ["Payday 12: 2027-12-30", "3: 18 working days"],
  "node-http-server.ts": ["holiday 23 শব-ই-বরাত 404"],
};

const examples = readdirSync(join(root, "examples")).filter((file) => file.endsWith(".ts"));
let failed = 0;
for (const file of examples) {
  const result = spawnSync(process.execPath, [...flags, "--no-warnings", join("examples", file)], {
    cwd: root,
    encoding: "utf8",
    timeout: 60_000,
  });
  const missing = (expectations[file] ?? []).filter((text) => !result.stdout.includes(text));
  if (result.status !== 0 || missing.length > 0) {
    failed++;
    console.error(`✗ ${file} (exit ${result.status})`);
    if (missing.length)
      console.error(`  missing output: ${missing.map((m) => JSON.stringify(m)).join(", ")}`);
    console.error(result.stderr || result.stdout);
  } else {
    console.log(`✓ ${file}`);
  }
}
const unchecked = Object.keys(expectations).filter((file) => !examples.includes(file));
if (unchecked.length) {
  console.error(`Expectations for missing examples: ${unchecked.join(", ")}`);
  failed++;
}
process.exit(failed ? 1 : 0);
