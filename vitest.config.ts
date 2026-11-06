import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/types/**", "src/**/*.d.ts"],
      reporter: ["text", "html", "lcov", "json-summary"],
      thresholds: { statements: 90, branches: 85, functions: 90, lines: 90 },
    },
  },
});
