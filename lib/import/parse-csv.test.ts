import { describe, expect, it } from "vitest";

import { countCsvRows, parseCsvText, peekCsvFile } from "@/lib/import/parse-csv";

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
    const parsed = parseCsvText(
      'name,description\n"Comma, Inc.","He said ""hi"""\n',
    );
    expect(parsed.rows[0]).toEqual(["Comma, Inc.", 'He said "hi"']);
  });

  it("skips fully empty lines", () => {
    const parsed = parseCsvText("name\nAlpha\n\n\nBeta\n");
    expect(parsed.rows).toEqual([["Alpha"], ["Beta"]]);
  });

  it("trims header whitespace", () => {
    expect(parseCsvText(" name , category \nA,b").headers).toEqual([
      "name",
      "category",
    ]);
  });
});

describe("countCsvRows", () => {
  it("counts data rows, ignoring newlines embedded in quoted fields", async () => {
    const big =
      "a,b\n" +
      Array.from({ length: 1000 }, (_, i) => `${i},"x\ny"`).join("\n") +
      "\n";
    expect(await countCsvRows(new Blob([big]))).toBe(1000);
  });

  it("is CRLF-aware and ignores blank lines, including a BOM-prefixed header", async () => {
    expect(
      await countCsvRows(new Blob(["﻿a,b\r\n1,2\r\n\r\n3,4\r\n"])),
    ).toBe(2);
  });
});

describe("peekCsvFile", () => {
  it("samples the requested number of rows without truncating a row split across chunks", async () => {
    const big =
      "a,b\n" +
      Array.from({ length: 1000 }, (_, i) => `${i},"x\ny"`).join("\n") +
      "\n";
    const sample = await peekCsvFile(new Blob([big]), 3);
    expect(sample.headers).toEqual(["a", "b"]);
    expect(sample.rows).toHaveLength(3);
    expect(sample.rows[0]).toEqual(["0", "x\ny"]);
  });
});
