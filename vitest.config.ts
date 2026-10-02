import path from "node:path";
import { defineConfig } from "vitest/config";

// Minimal unit-test setup (IMPLEMENTATION_PLAN §3 1A): pure-module tests for
// lib/rights.ts and components/shell/nav-config.ts run in a plain node
// environment — no DOM, no React renderer needed.
//
// .tsx specs (component-rendering tests) opt into jsdom per-file via a
// `// @vitest-environment jsdom` pragma at the top of the file — the global
// default here stays "node" so the existing pure-module suite is unaffected.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    include: [
      "lib/**/*.test.{ts,tsx}",
      "components/**/*.test.{ts,tsx}",
      "app/**/*.test.{ts,tsx}",
      // Root-level modules (proxy.ts CSP builder).
      "*.test.{ts,tsx}",
    ],
  },
});
