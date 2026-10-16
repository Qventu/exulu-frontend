// @vitest-environment jsdom
import { act } from "react";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DemoBuildGuard } from "./demo-build-guard";

/**
 * Mounted by the layout only when the SERVER says demo. In the browser,
 * isDemoMode() reads the value Next inlined at build time — so a guard that
 * finds it false has caught an image built without the flag and run with it
 * (the half demo of 2026-10-16), and says so instead of leaving a visitor
 * with "AI Studio" and session-token errors.
 */
describe("DemoBuildGuard", () => {
  const original = process.env.NEXT_PUBLIC_DEMO_MODE;
  let root: Root;
  let host: HTMLDivElement;
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    if (original === undefined) delete process.env.NEXT_PUBLIC_DEMO_MODE;
    else process.env.NEXT_PUBLIC_DEMO_MODE = original;
  });

  it("renders nothing when the bundle was built with the flag", async () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "true";
    await act(async () => root.render(createElement(DemoBuildGuard)));
    expect(host.textContent).toBe("");
  });

  it("names the missing build arg when the bundle was built without it", async () => {
    delete process.env.NEXT_PUBLIC_DEMO_MODE;
    await act(async () => root.render(createElement(DemoBuildGuard)));
    const alert = host.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain("NEXT_PUBLIC_DEMO_MODE");
    expect(alert?.textContent).toContain("Build");
  });
});
