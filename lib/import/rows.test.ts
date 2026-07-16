import { describe, expect, it } from "vitest";

import {
  buildCreateInput,
  buildUpdateInput,
  rowIsValid,
  rowsFromCsv,
  rowsFromFiles,
  validateRow,
} from "@/lib/import/rows";
import type { ImportField, ImportRow } from "@/lib/import/types";

const FIELDS: ImportField[] = [
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
    name: "description",
    label: "description",
    type: "longText",
    required: false,
    core: true,
  },
  { name: "tags", label: "tags", type: "text", required: false, core: true },
  {
    name: "category",
    label: "category",
    type: "enum",
    required: true,
    core: false,
    enumValues: ["a", "b"],
  },
  {
    name: "doc_s3key",
    label: "doc",
    type: "file",
    required: false,
    core: false,
    allowedFileTypes: [".pdf"],
  },
];

describe("rowsFromFiles", () => {
  it("creates one row per file with name prefilled (extension stripped)", () => {
    const rows = rowsFromFiles([new File(["x"], "Q3 Report.pdf")], "doc_s3key");
    expect(rows).toHaveLength(1);
    expect(rows[0].action).toBe("create");
    expect(rows[0].cells.name.value).toBe("Q3 Report");
    expect(rows[0].cells.doc_s3key.file?.name).toBe("Q3 Report.pdf");
  });
});

describe("rowsFromCsv", () => {
  const parsed = {
    headers: ["name", "category", "doc"],
    rows: [
      ["Alpha", "A", "exulu/user_1/uuid-_EXULU_report.pdf"],
      ["Beta", "b", "not-a-key"],
    ],
    errors: [],
  };
  const mapping = [
    { header: "name", index: 0, fieldName: "name" },
    { header: "category", index: 1, fieldName: "category" },
    { header: "doc", index: 2, fieldName: "doc_s3key" },
  ];

  it("coerces cells; file columns become storage keys", () => {
    const rows = rowsFromCsv(parsed, mapping, FIELDS);
    expect(rows[0].cells.category.value).toBe("a");
    expect(rows[0].cells.doc_s3key.value).toBe(
      "exulu/user_1/uuid-_EXULU_report.pdf",
    );
    expect(rows[1].cells.doc_s3key.error?.code).toBe("fileUrl");
  });

  it("skips unmapped columns", () => {
    const rows = rowsFromCsv(
      parsed,
      [{ header: "name", index: 0, fieldName: "name" }],
      FIELDS,
    );
    expect(Object.keys(rows[0].cells)).toEqual(["name"]);
  });
});

describe("validateRow", () => {
  it("flags missing required fields on create rows", () => {
    const row: ImportRow = {
      key: "r",
      action: "create",
      runState: "pending",
      cells: {},
    };
    const validated = validateRow(row, FIELDS);
    expect(validated.cells.name?.error?.code).toBe("required");
    expect(validated.cells.category?.error?.code).toBe("required");
    expect(rowIsValid(validated)).toBe(false);
  });

  it("on update rows only flags mapped-but-blank required fields", () => {
    const row: ImportRow = {
      key: "r",
      action: "update",
      targetItemId: "x",
      runState: "pending",
      cells: { name: { raw: "", value: "" } },
    };
    const validated = validateRow(row, FIELDS);
    expect(validated.cells.name?.error?.code).toBe("required");
    expect(validated.cells.category).toBeUndefined();
  });

  it("enforces allowedFileTypes against dropped file names", () => {
    const row: ImportRow = {
      key: "r",
      action: "create",
      runState: "pending",
      cells: {
        name: { raw: "n", value: "n" },
        category: { raw: "a", value: "a" },
        doc_s3key: {
          raw: "x.txt",
          value: "x.txt",
          file: new File(["x"], "x.txt"),
        },
      },
    };
    expect(validateRow(row, FIELDS).cells.doc_s3key.error?.code).toBe(
      "fileType",
    );
  });

  it("enforces allowedFileTypes against storage keys", () => {
    const row: ImportRow = {
      key: "r",
      action: "create",
      runState: "pending",
      cells: {
        name: { raw: "n", value: "n" },
        category: { raw: "a", value: "a" },
        doc_s3key: {
          raw: "exulu/user_1/uuid-_EXULU_x.txt",
          value: "exulu/user_1/uuid-_EXULU_x.txt",
        },
      },
    };
    expect(validateRow(row, FIELDS).cells.doc_s3key.error?.code).toBe(
      "fileType",
    );
  });

  it("clears a stale required error once the value is filled", () => {
    const row: ImportRow = {
      key: "r",
      action: "create",
      runState: "pending",
      cells: {
        name: {
          raw: "n",
          value: "n",
          error: { code: "required", params: { field: "name" } },
        },
        category: { raw: "a", value: "a" },
      },
    };
    expect(validateRow(row, FIELDS).cells.name.error).toBeUndefined();
  });
});

describe("buildCreateInput", () => {
  it("mirrors the single-item dialog shape with source import", () => {
    const row: ImportRow = {
      key: "r",
      action: "create",
      runState: "pending",
      cells: {
        id: { raw: "ignored", value: "ignored" },
        name: { raw: "Alpha", value: "Alpha" },
        description: { raw: "desc", value: "desc" },
        tags: { raw: "x,y", value: "x,y" },
        category: { raw: "a", value: "a" },
      },
    };
    expect(buildCreateInput(row, FIELDS)).toEqual({
      name: "Alpha",
      description: "desc",
      external_id: null,
      tags: "x,y",
      source: "import",
      textlength: 4,
      category: "a",
    });
  });
});

describe("buildUpdateInput", () => {
  it("sends only present cells, never id or source", () => {
    const row: ImportRow = {
      key: "r",
      action: "update",
      targetItemId: "item-1",
      runState: "pending",
      cells: {
        id: { raw: "item-1", value: "item-1" },
        description: { raw: "new", value: "new" },
        category: { raw: "b", value: "b" },
      },
    };
    expect(buildUpdateInput(row, FIELDS)).toEqual({
      description: "new",
      textlength: 3,
      category: "b",
    });
  });

  it("a mapped blank cell clears the field (null / empty string)", () => {
    const row: ImportRow = {
      key: "r",
      action: "update",
      targetItemId: "item-1",
      runState: "pending",
      cells: { doc_s3key: { raw: "", value: null } },
    };
    expect(buildUpdateInput(row, FIELDS)).toEqual({ doc_s3key: null });
  });
});
