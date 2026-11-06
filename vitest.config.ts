import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // The CLI imports the library by package name; resolve it to the source in tests.
    alias: { "bangladesh-holidays": fileURLToPath(new URL("./src/index.ts", import.meta.url)) },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/types/**", "src/**/*.d.ts", "src/cli/index.ts"],
      reporter: ["text", "html", "lcov", "json-summary"],
      thresholds: { statements: 90, branches: 85, functions: 90, lines: 90 },
    },
  },
});
