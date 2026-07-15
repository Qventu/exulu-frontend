import { describe, expect, it } from "vitest";

import { parseCsvText } from "@/lib/import/parse-csv";

describe("parseCsvText", () => {
  it("splits headers and rows", () => {
    const parsed = parseCsvText("name,category\nAlpha,a\nBeta,b\n");
    expect(parsed.headers).toEqual(["name", "category"]);
    expect(parsed.rows).toEqual([
      ["Alpha", "a"],
      ["Beta", "b"],
    ]);
  });

  it("handles quoted commas and quotes", () => {
    const parsed = parseCsvText('name,description\n"Comma, Inc.","He said ""hi"""\n');
    expect(parsed.rows[0]).toEqual(["Comma, Inc.", 'He said "hi"']);
  });

  it("skips fully empty lines", () => {
    const parsed = parseCsvText("name\nAlpha\n\n\nBeta\n");
    expect(parsed.rows).toEqual([["Alpha"], ["Beta"]]);
  });

  it("trims header whitespace", () => {
    expect(parseCsvText(" name , category \nA,b").headers).toEqual(["name", "category"]);
  });
});
