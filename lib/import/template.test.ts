import { describe, expect, it } from "vitest";

import { buildCsvTemplate, buildErrorReportCsv } from "@/lib/import/template";
import type { ImportField, ImportRow } from "@/lib/import/types";

const FIELDS: ImportField[] = [
  { name: "id", label: "id", type: "text", required: false, core: true },
  {
    name: "name",
    label: "name",
    type: "shortText",
    required: true,
    core: true,
  },
  {
    name: "doc_s3key",
    label: "doc",
    type: "file",
    required: false,
    core: false,
  },
];

describe("buildCsvTemplate", () => {
  it("emits a header row and an example row", () => {
    const fields: ImportField[] = [
      { name: "id", label: "id", type: "text", required: false, core: true },
      {
        name: "external_id",
        label: "external_id",
        type: "text",
        required: false,
        core: true,
      },
      {
        name: "name",
        label: "name",
        type: "shortText",
        required: true,
        core: true,
      },
      {
        name: "tags",
        label: "tags",
        type: "text",
        required: false,
        core: true,
      },
      {
        name: "count",
        label: "count",
        type: "number",
        required: false,
        core: false,
      },
      {
        name: "cat",
        label: "cat",
        type: "enum",
        required: false,
        core: false,
        enumValues: ["A", "B"],
      },
      {
        name: "doc_s3key",
        label: "doc",
        type: "file",
        required: false,
        core: false,
      },
    ];
    expect(buildCsvTemplate(fields)).toBe(
      'id,external_id,name,tags,count,cat,doc\n,example-id-123,Example item,"tag1,tag2",1.5,A,\n',
    );
  });

  it("escapes labels containing commas or quotes", () => {
    const fields = [
      {
        name: "x",
        label: 'weird, "label"',
        type: "text",
        required: false,
        core: false,
      },
    ];
    expect(buildCsvTemplate(fields)).toBe('"weird, ""label"""\nExample text\n');
  });
});

describe("buildErrorReportCsv", () => {
  const rows: ImportRow[] = [
    {
      key: "ok",
      action: "create",
      runState: "done",
      cells: { name: { raw: "fine", value: "fine" } },
    },
    {
      key: "bad",
      action: "create",
      runState: "failed",
      runError: "boom",
      cells: { name: { raw: "Broken, Inc.", value: "Broken, Inc." } },
    },
  ];

  it("includes only failed/errored rows, raw values, and the error column", () => {
    const csv = buildErrorReportCsv(
      rows,
      FIELDS,
      (r) => r.runError ?? "invalid",
    );
    expect(csv).toBe('id,name,doc,error\n,"Broken, Inc.",,boom\n');
  });

  it("exports the stored key for file cells that resolved to a value", () => {
    const fields: ImportField[] = [
      {
        name: "name",
        label: "name",
        type: "shortText",
        required: true,
        core: true,
      },
      {
        name: "doc_s3key",
        label: "doc",
        type: "file",
        required: false,
        core: false,
      },
    ];
    const rows: ImportRow[] = [
      {
        key: "bad",
        action: "create",
        runState: "failed",
        runError: "boom",
        cells: {
          name: { raw: "Alpha", value: "Alpha" },
          doc_s3key: {
            raw: "report.pdf",
            value: "exulu/user_1/uuid-_EXULU_report.pdf",
          },
        },
      },
    ];
    expect(buildErrorReportCsv(rows, fields, (r) => r.runError ?? "x")).toBe(
      "name,doc,error\nAlpha,exulu/user_1/uuid-_EXULU_report.pdf,boom\n",
    );
  });
});
