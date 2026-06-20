import path from "node:path";
import { defineConfig } from "vitest/config";

// Minimal unit-test setup (IMPLEMENTATION_PLAN §3 1A): pure-module tests for
// lib/rights.ts and components/shell/nav-config.ts run in a plain node
// environment — no DOM, no React renderer needed.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    include: [
      "lib/**/*.test.ts",
      "components/**/*.test.ts",
      "app/**/*.test.ts",
    ],
  },
});
