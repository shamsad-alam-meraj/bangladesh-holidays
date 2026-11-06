import { defineConfig } from "tsup";

export default defineConfig([
  {
    // The library: platform-neutral ESM + CJS with type declarations.
    entry: { index: "src/index.ts" },
    format: ["esm", "cjs"],
    target: "es2020",
    platform: "neutral",
    dts: true,
    sourcemap: true,
    clean: false,
    treeshake: true,
    splitting: false,
    outDir: "dist",
  },
  {
    // The CLI imports the library by package name, which resolves to dist/index.js at
    // runtime through the package's own "exports", so the library is not bundled twice.
    entry: { cli: "src/cli/index.ts" },
    format: ["esm"],
    target: "node20",
    platform: "node",
    external: ["bangladesh-holidays"],
    dts: false,
    sourcemap: false,
    clean: false,
    splitting: false,
    outDir: "dist",
  },
]);
