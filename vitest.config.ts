import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // All suites share the repo-local SQLite database. Serial workers avoid
    // cross-file write locks while preserving transaction-level assertions.
    minWorkers: 1,
    maxWorkers: 1,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
