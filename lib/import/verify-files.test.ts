import { describe, expect, it, vi } from "vitest";

import type { ImportField, ImportRow } from "@/lib/import/types";
import {
  applyMissingFileErrors,
  fileKeysOf,
  findMissingFileKeys,
} from "@/lib/import/verify-files";

const FIELDS: ImportField[] = [
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

const row = (key: string, cells: ImportRow["cells"]): ImportRow => ({
  key,
  action: "create",
  runState: "pending",
  cells,
});

describe("fileKeysOf", () => {
  it("collects unique string keys of file cells without attached Files", () => {
    const rows = [
      row("a", { doc_s3key: { raw: "b/k1", value: "b/k1" } }),
      row("b", { doc_s3key: { raw: "b/k1", value: "b/k1" } }),
      row("c", {
        doc_s3key: {
          raw: "x.pdf",
          value: "x.pdf",
          file: new File(["x"], "x.pdf"),
        },
      }),
      row("d", { name: { raw: "n", value: "n" } }),
    ];
    expect(fileKeysOf(rows, FIELDS)).toEqual(["b/k1"]);
  });
});

describe("findMissingFileKeys", () => {
  it("returns keys the check rejects or fails on", async () => {
    const exists = vi.fn(async (key: string) => {
      if (key === "b/gone") return false;
      if (key === "b/boom") throw new Error("network");
      return true;
    });
    const missing = await findMissingFileKeys(
      ["b/ok", "b/gone", "b/boom"],
      exists,
    );
    expect(missing).toEqual(new Set(["b/gone", "b/boom"]));
    expect(exists).toHaveBeenCalledTimes(3);
  });

  it("checks each unique key once", async () => {
    const exists = vi.fn(async () => true);
    await findMissingFileKeys(["b/k", "b/k", "b/k"], exists);
    expect(exists).toHaveBeenCalledTimes(1);
  });
});

describe("applyMissingFileErrors", () => {
  it("flags missing keys and clears stale fileNotFound errors", () => {
    const rows = [
      row("a", { doc_s3key: { raw: "b/gone", value: "b/gone" } }),
      row("b", {
        doc_s3key: {
          raw: "b/ok",
          value: "b/ok",
          error: { code: "fileNotFound" },
        },
      }),
      row("c", {
        doc_s3key: { raw: "junk", value: null, error: { code: "fileUrl" } },
      }),
    ];
    const result = applyMissingFileErrors(rows, FIELDS, new Set(["b/gone"]));
    expect(result[0].cells.doc_s3key.error?.code).toBe("fileNotFound");
    expect(result[1].cells.doc_s3key.error).toBeUndefined();
    expect(result[2].cells.doc_s3key.error?.code).toBe("fileUrl");
  });
});
