import { describe, expect, it } from "vitest";

import { footerControls } from "./panel-controls";

describe("footerControls", () => {
  it("offers Back and Next on an ordinary step", () => {
    expect(footerControls({ hasCta: false, isLast: false })).toEqual(["back", "next"]);
  });

  it("replaces Next with the call to action when a step has one", () => {
    expect(footerControls({ hasCta: true, isLast: true })).toEqual(["back", "cta"]);
    expect(footerControls({ hasCta: true, isLast: false })).toEqual(["back", "cta"]);
  });

  it("never offers a Next that does nothing", () => {
    // The 2026-10-14 walk: the closing step rendered Weiter, which was a no-op.
    expect(footerControls({ hasCta: false, isLast: true })).toEqual(["back"]);
  });
});
