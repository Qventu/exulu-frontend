/**
 * The composer blocks a send in three independent places — the submit funnel,
 * the Enter key, and the send button's disabled state — and a new reason to
 * block has to reach ALL of them. There is no test harness for the component
 * (it drags in autocomplete, speech-to-text, the file picker and the demo
 * autotype), so this asserts against its source, the way the backend's
 * chat-route-wiring test does for routes.ts.
 *
 * The decision itself is turnInFlight, unit-tested in lib/session-activity.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (): string =>
  readFileSync(join(__dirname, "composer.tsx"), "utf8");

describe("composer send gates", () => {
  it("routes every gate through turnInFlight rather than re-deriving it", () => {
    const uses = source().split("turnInFlight(").length - 1;
    expect(uses).toBeGreaterThanOrEqual(3);
  });

  it("imports the shared decision instead of keeping a local copy", () => {
    expect(source()).toContain('from "@/lib/session-activity"');
  });

  it("refuses the send in the submit funnel, which every path goes through", () => {
    // The button and the Enter key are courtesy; this is the guarantee.
    const submitBody = source().split("const submit = async")[1] ?? "";
    expect(submitBody.slice(0, 2500)).toContain("turnInFlight(");
  });

  it("tells the viewer why, rather than silently dropping the message", () => {
    expect(source()).toContain("composer.stillAnsweringToastTitle");
  });

  it("no longer gates the Enter key on status alone", () => {
    expect(source()).not.toContain(
      'status !== "submitted" && status !== "streaming" && input?.trim()',
    );
  });
});
