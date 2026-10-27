/**
 * Where the catching-up notice has to appear. Two distinct situations, and
 * the empty one is the reason this exists at all:
 *
 *   empty + catching up  — the session's FIRST turn is still running, so the
 *                          greeting empty state was telling the viewer to
 *                          start a conversation that was already under way.
 *   history + catching up — a follow-up turn is running; the stored history
 *                          shows, but the pending question and answer do not.
 *
 * Asserted against the source: rendering MessageColumn needs a whole
 * ChatSessionController plus lottie, and the notice itself is covered by
 * catching-up-notice.test.tsx.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (): string => readFileSync(join(__dirname, "message-column.tsx"), "utf8");

describe("MessageColumn catching-up states", () => {
  it("reads catchingUp off the controller", () => {
    expect(source()).toMatch(/catchingUp/);
  });

  it("renders the notice", () => {
    expect(source()).toContain("<CatchingUpNotice");
  });

  it("shows it in both the empty and the non-empty conversation", () => {
    const uses = source().split("<CatchingUpNotice").length - 1;
    expect(uses).toBe(2);
  });

  it("does not leave the greeting empty state showing while catching up", () => {
    // The greeting says "start a conversation"; the conversation has started.
    const emptyBranch = source().split("isEmpty &&")[1]?.slice(0, 2000) ?? "";
    expect(emptyBranch).toContain("catchingUp");
  });
});
