import { describe, expect, it } from "vitest";

import { buildCsvTemplate, buildErrorReportCsv } from "@/lib/import/template";
import type { ImportField, ImportRow } from "@/lib/import/types";

const FIELDS: ImportField[] = [
  { name: "id", label: "id", type: "text", required: false, core: true },
  { name: "name", label: "name", type: "shortText", required: true, core: true },
  { name: "doc_s3key", label: "doc", type: "file", required: false, core: false },
];

describe("buildCsvTemplate", () => {
  it("emits one header row using labels", () => {
    expect(buildCsvTemplate(FIELDS)).toBe("id,name,doc\n");
  });

  it("escapes labels containing commas or quotes", () => {
    const fields = [{ name: "x", label: 'weird, "label"', type: "text", required: false, core: false }];
    expect(buildCsvTemplate(fields)).toBe('"weird, ""label"""\n');
  });
});

describe("buildErrorReportCsv", () => {
  const rows: ImportRow[] = [
    { key: "ok", action: "create", runState: "done", cells: { name: { raw: "fine", value: "fine" } } },
    {
      key: "bad",
      action: "create",
      runState: "failed",
      runError: "boom",
      cells: { name: { raw: "Broken, Inc.", value: "Broken, Inc." } },
    },
  ];

  it("includes only failed/errored rows, raw values, and the error column", () => {
    const csv = buildErrorReportCsv(rows, FIELDS, (r) => r.runError ?? "invalid");
    expect(csv).toBe('id,name,doc,error\n,"Broken, Inc.",,boom\n');
  });
});
