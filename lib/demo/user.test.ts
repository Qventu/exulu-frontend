import { describe, expect, it } from "vitest";

import { NAV_ENTRIES } from "@/components/shell/nav-config";
import { can, isElevated } from "@/lib/rights";

import { getDemoUser } from "./user";
import { isDemoSupported } from "./supported-routes";

/**
 * The demo user's rights are load-bearing for which screens a prospect can
 * reach, and the failure is silent: a gate that closes renders AccessDenied,
 * which looks like a deliberate product state rather than a broken fixture.
 */
const demoUser = () => {
  const u = getDemoUser();
  return { super_admin: u.super_admin === true, role: u.role };
};

describe("demo user rights", () => {
  it("is a super-admin", () => {
    expect(getDemoUser().super_admin).toBe(true);
  });

  it("is elevated, so / does not bounce to /chat", () => {
    expect(isElevated(demoUser())).toBe(true);
  });

  // The two screens that carry the cost-and-control argument. /analytics is
  // gated `super_admin` outright and /budgets wants budget_management:read —
  // a role-shaped demo user met AccessDenied on both.
  it.each(["analytics", "budgets"])("can reach /%s", (id) => {
    const entry = NAV_ENTRIES.find((e) => e.id === id);
    expect(entry, `nav entry ${id} disappeared`).toBeDefined();
    expect(can(demoUser(), entry!.requires)).toBe(true);
  });

  it("passes every nav gate, so the sidebar is complete", () => {
    for (const entry of NAV_ENTRIES) {
      expect(can(demoUser(), entry.requires), `blocked on ${entry.id}`).toBe(true);
    }
  });

  // The consequence of the above, and why supported-routes.ts exists: an open
  // sidebar reaches routes with no fixtures behind them.
  // Not every entry has a route — some are group headers or open a dialog —
  // hence the filter before the check.
  it("reaches nav routes the demo has no fixtures for", () => {
    const unsupported = NAV_ENTRIES.filter(
      (e) => typeof e.route === "string" && !isDemoSupported(e.route),
    );
    expect(unsupported.length).toBeGreaterThan(0);
  });
});
