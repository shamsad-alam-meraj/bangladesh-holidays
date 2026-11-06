import { defineConfig } from "tsup";

export default defineConfig({
  entry: { index: "src/index.ts" },
  format: ["esm", "cjs"],
  target: "es2020",
  platform: "neutral",
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  splitting: false,
  outDir: "dist",
});
