/**
 * Using the command-line tool. In a terminal you would run `npx bangladesh-holidays …`;
 * this example runs the installed CLI programmatically.
 * Run: npm run build && node examples/cli-usage.ts
 */
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const packageJson = createRequire(import.meta.url).resolve("bangladesh-holidays/package.json");
const cli = join(dirname(packageJson), "dist", "cli.js");
const run = (...args: string[]) => execFileSync(process.execPath, [cli, ...args], { encoding: "utf8" });

console.log("$ bangladesh-holidays check 2027-03-26");
console.log(run("check", "2027-03-26"));
console.log("$ bangladesh-holidays add 2027-03-04 5");
console.log(run("add", "2027-03-04", "5"));
console.log("$ bangladesh-holidays leave 2027 --max-leave 1 --limit 2");
console.log(run("leave", "2027", "--max-leave", "1", "--limit", "2"));
console.log("$ bangladesh-holidays month 2027 5");
console.log(run("month", "2027", "5"));
console.log("$ bangladesh-holidays bangla 2027-04-14 --locale bn");
console.log(run("bangla", "2027-04-14", "--locale", "bn"));
