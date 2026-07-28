import { describe, expect, it } from "vitest";

import { mergeQueueOptions } from "./queue-options";

describe("mergeQueueOptions", () => {
  it("returns available unchanged when current is registered", () => {
    const available = [{ name: "a" }, { name: "b" }];
    expect(mergeQueueOptions(available, "b")).toEqual(available);
  });

  it("prepends current when it is not registered", () => {
    expect(mergeQueueOptions([{ name: "a" }], "gone")).toEqual([
      { name: "gone" },
      { name: "a" },
    ]);
  });

  it("returns available unchanged when current is empty/null", () => {
    const available = [{ name: "a" }];
    expect(mergeQueueOptions(available, null)).toEqual(available);
    expect(mergeQueueOptions(available, "")).toEqual(available);
  });
});
