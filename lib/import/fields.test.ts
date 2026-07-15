import { describe, expect, it } from "vitest";

import { CORE_FIELDS, fileFields, importableFields } from "@/lib/import/fields";
import type { Context } from "@/types/models/context";

const context = {
  id: "docs",
  fields: [
    { name: "category", type: "enum", label: "category", enumValues: ["a", "b"], required: true },
    { name: "document_s3key", type: "file", label: "document", allowedFileTypes: [".pdf"] },
    { name: "score", type: "number", label: "score", editable: false },
    { name: "summary", type: "longText", label: "summary", calculated: true },
  ],
} as unknown as Context;

describe("importableFields", () => {
  it("prepends core fields in order id, external_id, name, description, tags", () => {
    const names = importableFields(context).map((f) => f.name);
    expect(names.slice(0, 5)).toEqual(["id", "external_id", "name", "description", "tags"]);
  });

  it("skips non-editable and calculated fields", () => {
    const names = importableFields(context).map((f) => f.name);
    expect(names).not.toContain("score");
    expect(names).not.toContain("summary");
    expect(names).toContain("category");
    expect(names).toContain("document_s3key");
  });

  it("carries required, enumValues and allowedFileTypes through", () => {
    const fields = importableFields(context);
    const category = fields.find((f) => f.name === "category");
    expect(category?.required).toBe(true);
    expect(category?.enumValues).toEqual(["a", "b"]);
    const doc = fields.find((f) => f.name === "document_s3key");
    expect(doc?.allowedFileTypes).toEqual([".pdf"]);
    expect(doc?.label).toBe("document");
  });

  it("marks only the core name field as required among core fields", () => {
    expect(CORE_FIELDS.filter((f) => f.required).map((f) => f.name)).toEqual(["name"]);
  });
});

describe("fileFields", () => {
  it("returns only file-typed fields", () => {
    expect(fileFields(importableFields(context)).map((f) => f.name)).toEqual(["document_s3key"]);
  });
});
