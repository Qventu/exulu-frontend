import { describe, expect, it } from "vitest";

import { DEMO_SUPPORTED_ROUTES, isDemoSupported } from "./supported-routes";
import { CHAPTERS } from "./tour";

describe("isDemoSupported", () => {
  it("accepts an exact match", () => {
    expect(isDemoSupported("/agents")).toBe(true);
  });

  it("accepts a descendant of a supported route", () => {
    expect(isDemoSupported("/agents/edit/demo-agent-newton")).toBe(true);
    expect(isDemoSupported("/data/software_documentation_context")).toBe(true);
  });

  it("rejects a route the demo has no fixtures for", () => {
    expect(isDemoSupported("/configuration")).toBe(false);
    expect(isDemoSupported("/users")).toBe(false);
    expect(isDemoSupported("/keys")).toBe(false);
  });

  // The bug this rule exists to prevent: a naive startsWith would let
  // /agentsomething through on the strength of /agents.
  it("only matches on a segment boundary", () => {
    expect(isDemoSupported("/agentsomething")).toBe(false);
    expect(isDemoSupported("/datasets")).toBe(false);
  });

  // "/" is supported because it REDIRECTS to the tour's first step. Were it
  // absent, the layout would render the unavailable notice in place of the
  // page, the page would never run, and the redirect would never fire — the
  // demo's entry URL would dead-end on "not available".
  it("accepts the root entry point without matching everything", () => {
    expect(isDemoSupported("/")).toBe(true);
    expect(isDemoSupported("/configuration")).toBe(false);
  });

  it("ignores a trailing slash", () => {
    expect(isDemoSupported("/agents/")).toBe(true);
  });

  // Guards the allowlist against the tour drifting away from it: every route
  // a step navigates to must be reachable, or that step renders the notice.
  it("covers every route the tour navigates to", () => {
    for (const chapter of CHAPTERS) {
      for (const step of chapter.steps) {
        const pathname = step.route.split("?")[0];
        expect(
          isDemoSupported(pathname),
          `${chapter.id}.${step.id} navigates to ${pathname}, which the allowlist rejects`,
        ).toBe(true);
      }
    }
  });

  // The bug this caught in verification: proxy.ts writes x-next-pathname as
  // encodeURIComponent(pathname), because the layout's login redirect
  // interpolates it into a query string. Every route matched nothing, so the
  // unavailable notice rendered on ALL of them — and "/" failing meant the
  // page that performs the entry redirect never ran either.
  it("accepts a percent-encoded pathname", () => {
    expect(isDemoSupported("%2Fagents")).toBe(true);
    expect(isDemoSupported("%2Fagents%2Fedit%2Fdemo-agent-newton")).toBe(true);
    expect(isDemoSupported("%2F")).toBe(true);
    expect(isDemoSupported("%2Fconfiguration")).toBe(false);
  });

  it("does not throw on a malformed encoding", () => {
    expect(() => isDemoSupported("%")).not.toThrow();
    expect(isDemoSupported("%")).toBe(false);
  });

  it("lists each route once", () => {
    expect(new Set(DEMO_SUPPORTED_ROUTES).size).toBe(DEMO_SUPPORTED_ROUTES.length);
  });
});
