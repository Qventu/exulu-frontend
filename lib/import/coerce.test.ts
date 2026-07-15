import { describe, expect, it } from "vitest";

import { coerceValue } from "@/lib/import/coerce";
import type { ImportField } from "@/lib/import/types";

const field = (overrides: Partial<ImportField>): ImportField => ({
  name: "f",
  label: "f",
  type: "text",
  required: false,
  core: false,
  ...overrides,
});

describe("coerceValue: blanks", () => {
  it("keeps empty string for textual types", () => {
    expect(coerceValue(field({ type: "text" }), "").value).toBe("");
    expect(coerceValue(field({ type: "markdown" }), "  ").value).toBe("");
  });
  it("maps blank to null for non-textual types", () => {
    expect(coerceValue(field({ type: "number" }), "").value).toBeNull();
    expect(coerceValue(field({ type: "boolean" }), " ").value).toBeNull();
    expect(coerceValue(field({ type: "file" }), "").value).toBeNull();
  });
});

describe("coerceValue: number", () => {
  const num = field({ type: "number" });
  it("parses dot decimals", () => {
    expect(coerceValue(num, "1.5").value).toBe(1.5);
  });
  it("accepts unambiguous comma decimals (1-2 decimals)", () => {
    expect(coerceValue(num, "1,5").value).toBe(1.5);
    expect(coerceValue(num, "1,50").value).toBe(1.5);
  });
  it("rejects comma with three decimals as ambiguous thousands", () => {
    expect(coerceValue(num, "1,500").error?.code).toBe("numberAmbiguous");
  });
  it("rejects mixed separators and non-numbers", () => {
    expect(coerceValue(num, "1,234.56").error?.code).toBe("number");
    expect(coerceValue(num, "abc").error?.code).toBe("number");
  });
});

describe("coerceValue: boolean", () => {
  const bool = field({ type: "boolean" });
  it("accepts true/yes/ja/1 and false/no/nein/0, case-insensitive", () => {
    for (const v of ["true", "YES", "Ja", "1"]) expect(coerceValue(bool, v).value).toBe(true);
    for (const v of ["false", "No", "NEIN", "0"]) expect(coerceValue(bool, v).value).toBe(false);
  });
  it("rejects anything else", () => {
    expect(coerceValue(bool, "maybe").error?.code).toBe("boolean");
  });
});

describe("coerceValue: enum", () => {
  const en = field({ type: "enum", enumValues: ["Alpha", "Beta"] });
  it("matches case-insensitively and stores the canonical casing", () => {
    expect(coerceValue(en, "alpha").value).toBe("Alpha");
  });
  it("rejects unknown values and lists the options", () => {
    const cell = coerceValue(en, "gamma");
    expect(cell.error?.code).toBe("enum");
    expect(cell.error?.params?.values).toBe("Alpha, Beta");
  });
});

describe("coerceValue: date", () => {
  const date = field({ type: "date" });
  it("accepts ISO dates verbatim", () => {
    expect(coerceValue(date, "2026-07-15").value).toBe("2026-07-15");
    expect(coerceValue(date, "2026-07-15T10:00:00Z").value).toBe("2026-07-15T10:00:00Z");
  });
  it("rejects slash formats as ambiguous", () => {
    expect(coerceValue(date, "03/04/2026").error?.code).toBe("date");
  });
  it("falls back to Date.parse for unambiguous text dates", () => {
    const cell = coerceValue(date, "15 July 2026");
    expect(cell.error).toBeUndefined();
    expect(typeof cell.value).toBe("string");
  });
  it("rejects garbage", () => {
    expect(coerceValue(date, "not a date").error?.code).toBe("date");
  });
});

describe("coerceValue: json / uuid / file / text", () => {
  it("validates json but keeps the raw string as value", () => {
    expect(coerceValue(field({ type: "json" }), '{"a":1}').value).toBe('{"a":1}');
    expect(coerceValue(field({ type: "json" }), "{nope").error?.code).toBe("json");
  });
  it("validates uuid format", () => {
    expect(
      coerceValue(field({ type: "uuid" }), "123e4567-e89b-12d3-a456-426614174000").error,
    ).toBeUndefined();
    expect(coerceValue(field({ type: "uuid" }), "nope").error?.code).toBe("uuid");
  });
  it("passes file cell values through trimmed (filename matching happens later)", () => {
    expect(coerceValue(field({ type: "file" }), " report.pdf ").value).toBe("report.pdf");
  });
  it("keeps raw text for unknown types (backend-only types degrade to text)", () => {
    expect(coerceValue(field({ type: "somethingNew" }), "keep me").value).toBe("keep me");
  });
});
