#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import { runCli } from "./run";

process.exitCode = runCli(process.argv.slice(2), {
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
  writeFile: (path, content) => writeFileSync(path, content, "utf8"),
});
