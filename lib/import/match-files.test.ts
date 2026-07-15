import { describe, expect, it } from "vitest";

import { fileMatchKey, findFile, indexFiles, leftoverFiles } from "@/lib/import/match-files";
import type { ImportRow } from "@/lib/import/types";

const f = (name: string) => new File(["x"], name);

describe("fileMatchKey", () => {
  it("takes the basename and lowercases", () => {
    expect(fileMatchKey("C:\\docs\\Report.PDF")).toBe("report.pdf");
    expect(fileMatchKey("folder/Report.pdf")).toBe("report.pdf");
    expect(fileMatchKey(" Report.pdf ")).toBe("report.pdf");
  });
});

describe("indexFiles / findFile", () => {
  it("matches case-insensitively by basename", () => {
    const index = indexFiles([f("Report.PDF"), f("notes.txt")]);
    expect(findFile(index, "report.pdf")?.name).toBe("Report.PDF");
    expect(findFile(index, "missing.pdf")).toBeUndefined();
  });

  it("keeps the first file and reports duplicates", () => {
    const index = indexFiles([f("a.pdf"), f("A.PDF")]);
    expect(index.duplicateNames).toEqual(["A.PDF"]);
    expect(index.byName.size).toBe(1);
  });
});

describe("leftoverFiles", () => {
  it("returns files not referenced by any row cell", () => {
    const used = f("used.pdf");
    const unused = f("unused.pdf");
    const rows: ImportRow[] = [
      {
        key: "r1",
        action: "create",
        runState: "pending",
        cells: { doc: { raw: "used.pdf", value: "used.pdf", file: used } },
      },
    ];
    expect(leftoverFiles([used, unused], rows)).toEqual([unused]);
  });
});
