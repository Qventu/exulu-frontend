import { describe, expect, it } from "vitest";

import {
  countCsvRows,
  parseCsvText,
  peekCsvFile,
} from "@/lib/import/parse-csv";

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

  it("reports the delimiter it detected", () => {
    // The server-side import hands this to the worker so it parses the
    // uploaded file exactly the way the browser parsed the sample.
    expect(parseCsvText("a,b\n1,2\n").delimiter).toBe(",");
    expect(parseCsvText("a;b\n1;2\n").delimiter).toBe(";");
    expect(parseCsvText("a\tb\n1\t2\n").delimiter).toBe("\t");
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
    expect(await countCsvRows(new Blob(["﻿a,b\r\n1,2\r\n\r\n3,4\r\n"]))).toBe(
      2,
    );
  });

  it("is unaffected by a tiny chunk boundary landing inside a quoted field that contains a newline", async () => {
    const content = 'a,b\n1,"x\ny"\n2,z\n';
    expect(await countCsvRows(new Blob([content]), 7)).toBe(2);
  });

  it("counts a \\r\\n terminator once even when the chunk boundary falls between the \\r and the \\n", async () => {
    const content = "ab\r\n12\r\n";
    expect(await countCsvRows(new Blob([content]), 7)).toBe(1);
  });

  it("treats a doubled quote split across a chunk boundary as an escaped quote, not a close", async () => {
    const content = 'ab\n"x""y"\n3,4\n';
    expect(await countCsvRows(new Blob([content]), 6)).toBe(2);
  });

  it("counts a final row with content but no trailing newline, even when chunked", async () => {
    const content = "a,b\n1,2\n3,4";
    expect(await countCsvRows(new Blob([content]), 4)).toBe(2);
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

  it("does not truncate the last sample row when a tiny chunk boundary falls inside its quoted field", async () => {
    const content = 'a,b\n1,x\n2,"p\nq"\n';
    const sample = await peekCsvFile(new Blob([content]), 2, 11);
    expect(sample.rows).toEqual([
      ["1", "x"],
      ["2", "p\nq"],
    ]);
  });

  it("returns exactly sampleRows rows when a blank line sits inside the sample window", async () => {
    // Papa's `preview` option counts raw lines (including the blank one),
    // which previously undercounted data rows in this exact shape.
    const content = "a,b\n1,x\n\n2,y\n3,z\n4,w\n";
    const sample = await peekCsvFile(new Blob([content]), 3);
    expect(sample.rows).toEqual([
      ["1", "x"],
      ["2", "y"],
      ["3", "z"],
    ]);
  });

  it("returns all available rows when the file has fewer rows than sampleRows", async () => {
    const content = "a,b\n1,x\n2,y\n";
    const sample = await peekCsvFile(new Blob([content]), 5);
    expect(sample.rows).toEqual([
      ["1", "x"],
      ["2", "y"],
    ]);
  });

  it("reports the sampled file's delimiter", async () => {
    const sample = await peekCsvFile(new Blob(["a;b\n1;2\n2;3\n"]), 1);
    expect(sample.delimiter).toBe(";");
  });
});
