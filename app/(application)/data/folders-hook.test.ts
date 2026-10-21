// Unit tests for the pure sequencing helper behind useContextFolders'
// moveContext (see ./hooks.ts). Apollo/React parts of the hook are exercised
// through the component tests in Task 3 — this file only covers the one
// piece that is meaningfully unit-testable without a mocked provider:
// `applyMoves` applying a context's folder updates one at a time, in order,
// and stopping (rethrowing) at the first failure.

import { describe, expect, it, vi } from "vitest";

import { applyMoves } from "./hooks";

describe("applyMoves", () => {
  it("calls update sequentially in order; a throw on the second call leaves the first applied and rethrows", async () => {
    const applied: Array<{ id: string; context_ids: string[] }> = [];
    const update = vi.fn(
      async (id: string, input: { context_ids: string[] }): Promise<void> => {
        if (id === "f2") throw new Error("boom");
        applied.push({ id, context_ids: input.context_ids });
      },
    );

    await expect(
      applyMoves(
        [
          { id: "f1", context_ids: ["a"] },
          { id: "f2", context_ids: ["b"] },
          { id: "f3", context_ids: ["c"] },
        ],
        update,
      ),
    ).rejects.toThrow("boom");

    expect(applied).toEqual([{ id: "f1", context_ids: ["a"] }]);
    expect(update).toHaveBeenCalledTimes(2);
    expect(update.mock.calls[0]).toEqual(["f1", { context_ids: ["a"] }]);
    expect(update.mock.calls[1]).toEqual(["f2", { context_ids: ["b"] }]);
  });

  it("applies every update in order when all succeed", async () => {
    const applied: string[] = [];
    const update = vi.fn(async (id: string): Promise<void> => {
      applied.push(id);
    });

    await applyMoves(
      [
        { id: "f1", context_ids: ["a"] },
        { id: "f2", context_ids: ["b"] },
      ],
      update,
    );

    expect(applied).toEqual(["f1", "f2"]);
  });

  it("is a no-op for an empty updates list", async () => {
    const update = vi.fn(async (): Promise<void> => {});
    await applyMoves([], update);
    expect(update).not.toHaveBeenCalled();
  });
});
