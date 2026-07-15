import { describe, expect, it } from "vitest";

import { autoMapColumns, normalizeHeader } from "@/lib/import/map-columns";
import type { ImportField } from "@/lib/import/types";

const fields: ImportField[] = [
  { name: "id", label: "id", type: "text", required: false, core: true },
  { name: "external_id", label: "external_id", type: "text", required: false, core: true },
  { name: "name", label: "name", type: "shortText", required: true, core: true },
  { name: "document_s3key", label: "document", type: "file", required: false, core: false },
  { name: "category", label: "category", type: "enum", required: false, core: false },
];

describe("normalizeHeader", () => {
  it("lowercases, trims and unifies separators", () => {
    expect(normalizeHeader(" External ID ")).toBe("external_id");
    expect(normalizeHeader("document-s3key")).toBe("document_s3key");
  });
});

describe("autoMapColumns", () => {
  it("matches by field name or label, case/separator-insensitive", () => {
    const mapping = autoMapColumns(["Name", "External ID", "document", "unknown"], fields);
    expect(mapping.map((m) => m.fieldName)).toEqual(["name", "external_id", "document_s3key", null]);
    expect(mapping[2].index).toBe(2);
  });

  it("maps a file column by its storage name too", () => {
    expect(autoMapColumns(["document_s3key"], fields)[0].fieldName).toBe("document_s3key");
  });

  it("never maps two columns to the same field", () => {
    const mapping = autoMapColumns(["name", "Name"], fields);
    expect(mapping[0].fieldName).toBe("name");
    expect(mapping[1].fieldName).toBeNull();
  });
});
