/**
 * Packaging smoke test. Packs the library with `npm pack`, installs the tarball
 * into a throwaway consumer project and verifies that it works as:
 *   - an ES module (import) and a CommonJS module (require)
 *   - TypeScript with moduleResolution "nodenext" (ESM + CJS) and "bundler",
 *     type-checking the published .d.ts files (skipLibCheck: false)
 *   - a browser bundle (esbuild, platform "browser") with no Node built-ins
 * Run `npm run build` first.
 */
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const root = fileURLToPath(new URL("..", import.meta.url));
const work = join(root, ".smoke");
const consumer = join(work, "consumer");
const run = (command, cwd) => execSync(command, { cwd, stdio: "pipe", encoding: "utf8" });
const step = (name) => console.log(`• ${name}`);

if (!existsSync(join(root, "dist", "index.js"))) {
  console.error("dist/ not found — run `npm run build` first.");
  process.exit(1);
}

rmSync(work, { recursive: true, force: true });
mkdirSync(consumer, { recursive: true });

step("npm pack");
const [packed] = JSON.parse(run(`npm pack --json --pack-destination "${work}"`, root));
const files = packed.files.map((file) => file.path);
for (const required of [
  "dist/index.js",
  "dist/index.cjs",
  "dist/index.d.ts",
  "dist/index.d.cts",
  "src/data/government/2027.json",
  "schema/holiday-dataset.schema.json",
  "LICENSE",
  "README.md",
]) {
  if (!files.includes(required)) throw new Error(`Tarball is missing ${required}`);
}
const unexpected = files.filter((file) => /^(tests|examples|scripts|src\/(core|types|utils))\//.test(file));
if (unexpected.length) throw new Error(`Tarball contains development files: ${unexpected.join(", ")}`);
console.log(`  ${packed.filename}: ${files.length} files, ${(packed.size / 1024).toFixed(1)} kB packed`);

step("install tarball into a consumer project");
writeFileSync(
  join(consumer, "package.json"),
  JSON.stringify({ name: "consumer", private: true, type: "module" }),
);
run(`npm install --no-audit --no-fund --ignore-scripts "${join(work, packed.filename)}"`, consumer);

step("ESM import");
writeFileSync(
  join(consumer, "esm.mjs"),
  `import { getHolidays, getHoliday, createHolidayCalendar, VERSION } from "bangladesh-holidays";
import assert from "node:assert/strict";
import data from "bangladesh-holidays/data/government/2027.json" with { type: "json" };
assert.equal(getHolidays(2027).length, 23);
assert.equal(getHoliday("2027-03-26", { locale: "bn-BD" }).name, "স্বাধীনতা ও জাতীয় দিবস");
assert.equal(createHolidayCalendar().addBusinessDays("2027-03-04", 1), "2027-03-14");
assert.equal(data.year, 2027);
assert.match(VERSION, /^\\d+\\.\\d+\\.\\d+/);
console.log("esm ok");
`,
);
console.log(" ", run(`"${process.execPath}" esm.mjs`, consumer).trim());

step("CommonJS require");
writeFileSync(
  join(consumer, "cjs.cjs"),
  `const assert = require("node:assert/strict");
const bh = require("bangladesh-holidays");
assert.equal(bh.getHolidays(2027).length, 23);
assert.equal(bh.isBusinessDay("2027-03-26"), false);
assert.ok(bh.createHolidayCalendar() instanceof bh.HolidayCalendar);
assert.throws(() => bh.isHoliday("2028-01-02"), bh.HolidayDataUnavailableError);
assert.equal(require("bangladesh-holidays/data/government/2027.json").calendar, "government");
assert.equal(require("bangladesh-holidays/package.json").name, "bangladesh-holidays");
console.log("cjs ok");
`,
);
console.log(" ", run(`"${process.execPath}" cjs.cjs`, consumer).trim());

step("TypeScript consumers (published declarations, skipLibCheck: false)");
const tsSource = `import { createHolidayCalendar, getHoliday, type Holiday, type CalendarOptions } from "bangladesh-holidays";
const options: CalendarOptions = { year: 2027, locale: "bn-BD", weekend: [5, 6] };
const holiday: Holiday | undefined = getHoliday("2027-03-26", options);
const days: readonly string[] = createHolidayCalendar(options).getWorkingDays(2027, 3);
export const result: [string | undefined, number] = [holiday?.name, days.length];
`;
writeFileSync(join(consumer, "esm-consumer.mts"), tsSource);
writeFileSync(
  join(consumer, "cjs-consumer.cts"),
  `import bh = require("bangladesh-holidays");
const holiday: bh.Holiday | undefined = bh.getHoliday("2027-03-26");
export = holiday?.name;
`,
);
writeFileSync(join(consumer, "bundler-consumer.ts"), tsSource);
const tsc = `node "${join(root, "node_modules", "typescript", "bin", "tsc")}"`;
const common =
  '--strict --noEmit --skipLibCheck false --target es2020 --types node --typeRoots "' +
  join(root, "node_modules", "@types") +
  '"';
run(
  `${tsc} ${common} --module nodenext --moduleResolution nodenext esm-consumer.mts cjs-consumer.cts`,
  consumer,
);
run(`${tsc} ${common} --module esnext --moduleResolution bundler bundler-consumer.ts`, consumer);
console.log("  nodenext (ESM + CJS) and bundler resolution ok");

step("browser bundle");
const { build } = await import("esbuild");
const bundle = await build({
  stdin: {
    contents: `import { getHolidays } from "bangladesh-holidays"; globalThis.result = getHolidays(2027).length;`,
    resolveDir: consumer,
  },
  bundle: true,
  write: false,
  platform: "browser",
  format: "esm",
  minify: true,
  logLevel: "silent",
});
const code = bundle.outputFiles[0].text;
if (/\bnode:|require\(/.test(code)) throw new Error("Browser bundle references Node built-ins");
const fn = new Function(`${code}; return globalThis.result;`);
if (fn() !== 23) throw new Error("Browser bundle produced the wrong result");
console.log(
  `  ok — ${(code.length / 1024).toFixed(1)} kB minified, ${(gzipSync(code).length / 1024).toFixed(1)} kB gzipped`,
);

const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
rmSync(work, { recursive: true, force: true });
console.log(`\nSmoke test passed for ${pkg.name}@${pkg.version} on Node ${process.versions.node}`);
