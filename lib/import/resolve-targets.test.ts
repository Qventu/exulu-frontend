import { describe, expect, it } from "vitest";

import { classifyRows } from "@/lib/import/resolve-targets";
import type { ImportRow } from "@/lib/import/types";

const row = (key: string, cells: ImportRow["cells"]): ImportRow => ({
  key,
  action: "create",
  runState: "pending",
  cells,
});

const existing = {
  byExternalId: new Map([["ext-1", "item-1"]]),
  knownIds: new Set(["item-9"]),
};

describe("classifyRows", () => {
  it("id column wins and must exist", () => {
    const rows = classifyRows(
      [
        row("a", { id: { raw: "item-9", value: "item-9" } }),
        row("b", { id: { raw: "nope", value: "nope" } }),
      ],
      existing,
    );
    expect(rows[0].action).toBe("update");
    expect(rows[0].targetItemId).toBe("item-9");
    expect(rows[1].error?.code).toBe("idNotFound");
  });

  it("matching external_id updates, unknown external_id creates", () => {
    const rows = classifyRows(
      [
        row("a", { external_id: { raw: "ext-1", value: "ext-1" } }),
        row("b", { external_id: { raw: "new-ext", value: "new-ext" } }),
      ],
      existing,
    );
    expect(rows[0].action).toBe("update");
    expect(rows[0].targetItemId).toBe("item-1");
    expect(rows[1].action).toBe("create");
    expect(rows[1].error).toBeUndefined();
  });

  it("duplicate keys within the batch error on later rows", () => {
    const rows = classifyRows(
      [
        row("a", { external_id: { raw: "x", value: "x" } }),
        row("b", { external_id: { raw: "x", value: "x" } }),
        row("c", { id: { raw: "item-9", value: "item-9" } }),
        row("d", { id: { raw: "item-9", value: "item-9" } }),
      ],
      existing,
    );
    expect(rows[0].error).toBeUndefined();
    expect(rows[1].error?.code).toBe("duplicateKey");
    expect(rows[1].error?.params?.field).toBe("external_id");
    expect(rows[3].error?.code).toBe("duplicateKey");
  });

  it("re-running clears stale classification", () => {
    const stale: ImportRow = {
      ...row("a", {}),
      action: "update",
      targetItemId: "old",
      error: { code: "idNotFound" },
    };
    const [reclassified] = classifyRows([stale], existing);
    expect(reclassified.action).toBe("create");
    expect(reclassified.targetItemId).toBeUndefined();
    expect(reclassified.error).toBeUndefined();
  });
});
