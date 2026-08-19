import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Guards the raw SQL in the public-auth routes against a failure mode that
 * TypeScript cannot see and unit tests with a fake client cannot reach: these
 * statements are template strings, so anything inside them goes to Postgres
 * verbatim and is only parsed at runtime, on a real request.
 *
 * This is not hypothetical. A "//" comment line inside one of these strings
 * shipped and produced `syntax error at or near "//"` (SQLSTATE 42601) on every
 * registration of a returning user — a 500 in production code that typechecked
 * clean and passed every existing test.
 */
const DATEIEN = [
  "app/api/public-auth/ensure-user/route.ts",
  "app/api/public-auth/consent/route.ts",
  "app/api/public-auth/erasure-request/route.ts",
  "lib/public-auth/otp-rate-limit.ts",
];

/** Extracts the contents of every backtick template literal in a file. */
function sqlLiterale(quelle: string): string[] {
  return [...quelle.matchAll(/`([^`]*)`/g)]
    .map((m) => m[1])
    .filter((s) => /\b(SELECT|INSERT|UPDATE|DELETE)\b/i.test(s));
}

describe("SQL hygiene in the public-auth routes", () => {
  for (const datei of DATEIEN) {
    it(`${datei} has no JS-style comments inside its SQL`, () => {
      const quelle = readFileSync(join(process.cwd(), datei), "utf8");
      for (const sql of sqlLiterale(quelle)) {
        // Postgres knows "--" and "/* */". It does not know "//".
        expect(sql, `JS comment inside SQL in ${datei}`).not.toMatch(/^\s*\/\//m);
      }
    });

    it(`${datei} keeps prose out of its SQL entirely`, () => {
      // Even valid "--" comments do not belong here: they are shipped to the
      // database on every call, and a typo in them is a runtime error rather
      // than a compile-time one. Explanations belong in TypeScript comments
      // above the query.
      const quelle = readFileSync(join(process.cwd(), datei), "utf8");
      for (const sql of sqlLiterale(quelle)) {
        expect(sql, `SQL comment inside a query in ${datei}`).not.toMatch(
          /^\s*--/m,
        );
      }
    });
  }
});
