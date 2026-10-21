import { describe, expect, it } from "vitest";

import { retryMapping } from "@/lib/import/retry";

describe("retryMapping", () => {
  it("appends an import_error column to the original mapping", () => {
    expect(
      retryMapping([{ header: "name", fieldName: "name" }]),
    ).toEqual([
      { header: "name", fieldName: "name" },
      { header: "import_error", fieldName: null },
    ]);
  });
});
