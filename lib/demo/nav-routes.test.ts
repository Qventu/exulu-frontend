import { describe, expect, it } from "vitest";

import { NAV_ENTRIES, visibleEntries } from "@/components/shell/nav-config";
import { demoConfig } from "./config";
import { DEMO_NAV_ROUTES } from "./nav-routes";
import { CHAPTERS } from "./tour";
import { getDemoUser } from "./user";

const topLevel = (route: string) => "/" + (route.split("?")[0].split("/")[1] ?? "");

describe("DEMO_NAV_ROUTES", () => {
  it("allows every route a step visits (scenes excepted — they are not in the nav)", () => {
    for (const chapter of CHAPTERS) {
      for (const step of chapter.steps) {
        const top = topLevel(step.route);
        if (top === "/demo") continue;
        expect(DEMO_NAV_ROUTES.has(top), `${chapter.id}.${step.id} visits ${top}`).toBe(true);
      }
    }
  });

  it("allows nothing the tour never visits", () => {
    const visited = new Set(CHAPTERS.flatMap((c) => c.steps.map((s) => topLevel(s.route))));
    visited.add("/");
    for (const route of DEMO_NAV_ROUTES) expect(visited.has(route), `${route} is allowed but never visited`).toBe(true);
  });

  it("filters the shell's entries down to the allowlist", () => {
    // The demo's own /config: /transcriptions is behind a config flag, and
    // the demo enables it (lib/demo/config.ts), as the Transkripte entry shows.
    const user = getDemoUser();
    const config = demoConfig();
    const entries = visibleEntries(user, config, DEMO_NAV_ROUTES);
    expect(entries.map((e) => e.route).sort()).toEqual([...DEMO_NAV_ROUTES].sort());
    // and without the allowlist the super-admin sees the whole product
    expect(visibleEntries(user, config, undefined).length).toBeGreaterThan(entries.length);
    expect(NAV_ENTRIES.length).toBeGreaterThan(entries.length);
  });
});
