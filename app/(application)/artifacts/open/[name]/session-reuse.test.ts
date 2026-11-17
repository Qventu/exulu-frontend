/**
 * The panel's reuse rule: a request may land in the mounted session only when
 * both name the same project, where "no project" is a project of its own.
 * A request without one must never land in a project's conversation (the
 * backend's create_project tool refuses a session that already has a
 * project), and a project's request must never land in a conversation that
 * has none or another one.
 */
import { describe, expect, test } from "vitest";

import { needsFreshSession } from "./session-reuse";

describe("needsFreshSession", () => {
  test.each([
    [null, null],
    [undefined, null],
    ["a", "a"],
  ] as const)("reuses when the projects match (%s, %s)", (current, requested) => {
    expect(needsFreshSession(current, requested)).toBe(false);
  });

  test.each([
    ["a", null],
    [null, "a"],
    ["a", "b"],
  ] as const)("starts fresh when they differ (%s, %s)", (current, requested) => {
    expect(needsFreshSession(current, requested)).toBe(true);
  });
});
