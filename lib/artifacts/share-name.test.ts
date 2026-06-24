import { describe, test, expect } from "vitest";
import { slugifyShareName } from "./share-name";

describe("slugifyShareName", () => {
  test("slugifies a key basename and drops the _EXULU_ prefix", () => {
    expect(slugifyShareName("uploads/9f3a_EXULU_Quarterly Report.pdf")).toBe(
      "quarterly-report.pdf",
    );
  });
});
