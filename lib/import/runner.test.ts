import { describe, expect, it, vi } from "vitest";

import { runImport } from "@/lib/import/runner";
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
    name: "doc_s3key",
    label: "doc",
    type: "file",
    required: false,
    core: false,
  },
];

const createRow = (key: string, name: string, file?: File): ImportRow => ({
  key,
  action: "create",
  runState: "pending",
  cells: {
    name: { raw: name, value: name },
    ...(file ? { doc_s3key: { raw: file.name, value: file.name, file } } : {}),
  },
});

const effects = () => ({
  uploadFile: vi.fn(
    async (file: File) => `bucket/user_1/uuid-_EXULU_${file.name}`,
  ),
  createItem: vi.fn(async () => {}),
  updateItem: vi.fn(async () => {}),
});

describe("runImport", () => {
  it("uploads file cells first and sends the s3key in the input", async () => {
    const fx = effects();
    const rows = [createRow("r1", "Alpha", new File(["x"], "a.pdf"))];
    const summary = await runImport(rows, FIELDS, fx, { onRowState: () => {} });
    expect(fx.uploadFile).toHaveBeenCalledTimes(1);
    expect(fx.createItem).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Alpha",
        doc_s3key: "bucket/user_1/uuid-_EXULU_a.pdf",
        source: "import",
      }),
    );
    expect(summary).toEqual({ created: 1, updated: 0, failed: 0, skipped: 0 });
    expect(rows[0].runState).toBe("done");
    expect(rows[0].cells.doc_s3key.file).toBeUndefined();
  });

  it("routes update rows to updateItem with the target id", async () => {
    const fx = effects();
    const row: ImportRow = {
      key: "u1",
      action: "update",
      targetItemId: "item-1",
      runState: "pending",
      cells: { description: { raw: "d", value: "d" } },
    };
    const summary = await runImport([row], FIELDS, fx, {
      onRowState: () => {},
    });
    expect(fx.updateItem).toHaveBeenCalledWith("item-1", {
      description: "d",
      textlength: 1,
    });
    expect(summary.updated).toBe(1);
  });

  it("isolates failures and reports them via onRowState", async () => {
    const fx = effects();
    fx.createItem
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(undefined);
    const states: Array<[string, string, string | undefined]> = [];
    const rows = [createRow("r1", "A"), createRow("r2", "B")];
    const summary = await runImport(rows, FIELDS, fx, {
      concurrency: 1,
      onRowState: (key, state, error) => states.push([key, state, error]),
    });
    expect(summary.failed).toBe(1);
    expect(summary.created).toBe(1);
    expect(states).toContainEqual(["r1", "failed", "boom"]);
    expect(rows[0].runState).toBe("failed");
    expect(rows[1].runState).toBe("done");
  });

  it("skips invalid and done rows (retry semantics)", async () => {
    const fx = effects();
    const done = { ...createRow("d", "Done"), runState: "done" as const };
    const invalid: ImportRow = {
      key: "bad",
      action: "create",
      runState: "pending",
      cells: { name: { raw: "", value: "", error: { code: "required" } } },
    };
    const summary = await runImport(
      [done, invalid, createRow("ok", "Ok")],
      FIELDS,
      fx,
      {
        onRowState: () => {},
      },
    );
    expect(fx.createItem).toHaveBeenCalledTimes(1);
    expect(summary.skipped).toBe(2);
  });

  it("stops issuing new rows when cancelled", async () => {
    const fx = effects();
    let cancelled = false;
    fx.createItem.mockImplementation(async () => {
      cancelled = true;
    });
    const rows = [
      createRow("r1", "A"),
      createRow("r2", "B"),
      createRow("r3", "C"),
    ];
    const summary = await runImport(rows, FIELDS, fx, {
      concurrency: 1,
      isCancelled: () => cancelled,
      onRowState: () => {},
    });
    expect(summary.created).toBe(1);
    expect(rows[2].runState).toBe("pending");
  });

  it("update inputs never contain rights fields (batch access is create-only)", async () => {
    const fx = effects();
    const row: ImportRow = {
      key: "u2",
      action: "update",
      targetItemId: "item-2",
      runState: "pending",
      cells: { description: { raw: "d", value: "d" } },
    };
    await runImport([row], FIELDS, fx, { onRowState: () => {} });
    const input = fx.updateItem.mock.calls[0][1];
    expect(input).not.toHaveProperty("rights_mode");
    expect(input).not.toHaveProperty("RBAC");
  });
});
