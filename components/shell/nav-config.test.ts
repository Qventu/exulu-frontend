// Tests for the declarative navigation table (navigation.md §1.2) and its
// normative rendering rules (§1.3). The single-right matrix is the Phase 1
// exit criterion: for EVERY single role right we assert exactly which entries
// render — e.g. a budget_management:read-only account sees ONLY
// Administration → Budgets plus the all-user entries (and Home via elevated).

import { describe, expect, it } from "vitest";

import {
  activeEntryFor,
  GROUP_I18N_KEYS,
  groupsFor,
  NAV_ENTRIES,
  visibleEntries,
  type NavConfig,
} from "@/components/shell/nav-config";
import type { RightArea, RightsUser } from "@/lib/rights";
import type { UserRole } from "@/types/models/user-role";

const emptyRole: UserRole = {
  id: "role-1",
  name: "test-role",
  agents: null,
  workflows: null,
  variables: null,
  users: null,
  api: null,
  evals: null,
  budget_management: null,
};

function userWith(
  rights: Partial<Record<RightArea, "read" | "write">> = {},
  superAdmin = false,
): RightsUser {
  return { super_admin: superAdmin, role: { ...emptyRole, ...rights } };
}

const superAdmin = userWith({}, true);
const p1User = userWith(); // authenticated, zero role rights

/** Every config flag on — isolates the RBAC dimension. */
const fullConfig: NavConfig = {
  transcription: { enabled: true },
  n8n: { enabled: true },
  feedback: { enabled: true },
};
/** Every config flag off/absent. */
const bareConfig: NavConfig = {};

const ids = (user: RightsUser, config: NavConfig = fullConfig) =>
  visibleEntries(user, config).map((entry) => entry.id);

/** What every authenticated account sees (full config), in table order. */
const ALL_USER_BODY = ["chat", "projects", "transcripts"];
const FOOTER = ["send-feedback", "settings"];

describe("the table itself (§1.2)", () => {
  it("contains every row of the spec table, footer included, user menu excluded", () => {
    expect(NAV_ENTRIES.map((entry) => entry.id)).toEqual([
      "home",
      "chat",
      "projects",
      "transcripts",
      "agents",
      "knowledge",
      "prompts",
      "skills",
      "routines",
      "automation",
      "feedback",
      "evals",
      "explorer",
      "keys",
      "token",
      "users",
      "models",
      "budgets",
      "analytics",
      "variables",
      "configuration",
      "send-feedback",
      "settings",
    ]);
  });

  it("has unique ids and navigation.* i18n keys throughout", () => {
    const allIds = NAV_ENTRIES.map((entry) => entry.id);
    expect(new Set(allIds).size).toBe(allIds.length);
    for (const entry of NAV_ENTRIES) {
      expect(entry.i18nKey).toMatch(/^navigation\./);
    }
    expect(Object.values(GROUP_I18N_KEYS)).toEqual([
      "navigation.groups.workspace",
      "navigation.groups.build",
      "navigation.groups.develop",
      "navigation.groups.administration",
      "navigation.groups.personal",
    ]);
  });

  it("send-feedback is the dialog entry: no route", () => {
    const sendFeedback = NAV_ENTRIES.find(
      (entry) => entry.id === "send-feedback",
    );
    expect(sendFeedback?.route).toBeNull();
    expect(sendFeedback?.configFlag).toBe("feedback");
  });
});

describe("single-right matrix (Phase 1 exit criterion)", () => {
  it("agents:read → Build's read surfaces (agents, knowledge interim, prompts), no skills/models", () => {
    expect(ids(userWith({ agents: "read" }))).toEqual([
      "home",
      ...ALL_USER_BODY,
      "agents",
      "knowledge",
      "prompts",
      ...FOOTER,
    ]);
  });

  it("agents:write → adds skills + Models (interim gate, audit M4)", () => {
    expect(ids(userWith({ agents: "write" }))).toEqual([
      "home",
      ...ALL_USER_BODY,
      "agents",
      "knowledge",
      "prompts",
      "skills",
      "models",
      ...FOOTER,
    ]);
  });

  it("workflows:read → routines + automation (n8n flag on)", () => {
    expect(ids(userWith({ workflows: "read" }))).toEqual([
      "home",
      ...ALL_USER_BODY,
      "routines",
      "automation",
      ...FOOTER,
    ]);
  });

  it("evals:read → only Develop → Evals", () => {
    expect(ids(userWith({ evals: "read" }))).toEqual([
      "home",
      ...ALL_USER_BODY,
      "evals",
      ...FOOTER,
    ]);
  });

  it("users:write → only Administration → Users & access", () => {
    expect(ids(userWith({ users: "write" }))).toEqual([
      "home",
      ...ALL_USER_BODY,
      "users",
      ...FOOTER,
    ]);
  });

  it("users:read → nothing beyond the all-user set (gate is users:w) + Home via elevated", () => {
    expect(ids(userWith({ users: "read" }))).toEqual([
      "home",
      ...ALL_USER_BODY,
      ...FOOTER,
    ]);
  });

  it("variables:read → only Administration → Variables", () => {
    expect(ids(userWith({ variables: "read" }))).toEqual([
      "home",
      ...ALL_USER_BODY,
      "variables",
      ...FOOTER,
    ]);
  });

  it("api:read → only Develop → Personal token (no Explorer, no API keys)", () => {
    expect(ids(userWith({ api: "read" }))).toEqual([
      "home",
      ...ALL_USER_BODY,
      "token",
      ...FOOTER,
    ]);
  });

  it("api:write → Explorer + API keys + Personal token (all Develop)", () => {
    expect(ids(userWith({ api: "write" }))).toEqual([
      "home",
      ...ALL_USER_BODY,
      "explorer",
      "keys",
      "token",
      ...FOOTER,
    ]);
  });

  it("budget_management:read → ONLY Administration → Budgets + all-user entries + Home via elevated", () => {
    expect(ids(userWith({ budget_management: "read" }))).toEqual([
      "home",
      ...ALL_USER_BODY,
      "budgets",
      ...FOOTER,
    ]);
  });
});

describe("persona matrix (§1.3)", () => {
  it("P1-only: 3–5 items, flat sidebar (headers suppressed), NO Home", () => {
    const withFlags = ids(p1User, fullConfig);
    expect(withFlags).toEqual([...ALL_USER_BODY, ...FOOTER]); // 5
    expect(withFlags).not.toContain("home");

    const withoutFlags = ids(p1User, bareConfig);
    expect(withoutFlags).toEqual(["chat", "projects", "settings"]); // 3

    const tree = groupsFor(p1User, fullConfig);
    expect(tree.top).toEqual([]);
    expect(tree.groups.map((group) => group.group)).toEqual(["workspace"]);
    expect(tree.suppressGroupHeaders).toBe(true);
    // Settings is palette-visible but lives in the user menu, not the footer.
    expect(tree.personal.map((entry) => entry.id)).toEqual(["send-feedback"]);
  });

  it("only Administration is collapsible (§1.3 #3 amendment, 2026-06-11)", () => {
    const tree = groupsFor(superAdmin, fullConfig);
    expect(
      tree.groups.map((group) => [group.group, group.collapsible]),
    ).toEqual([
      ["workspace", false],
      ["build", false],
      ["develop", false],
      ["administration", true],
    ]);
  });

  it("settings: in visibleEntries (palette) but never in the sidebar tree", () => {
    expect(ids(superAdmin, fullConfig)).toContain("settings");
    const tree = groupsFor(superAdmin, fullConfig);
    const sidebarIds = [
      ...tree.top,
      ...tree.groups.flatMap((group) => group.entries),
      ...tree.personal,
    ].map((entry) => entry.id);
    expect(sidebarIds).not.toContain("settings");
  });

  it("super admin: everything (all 23 rows with full config)", () => {
    expect(ids(superAdmin, fullConfig)).toEqual(
      NAV_ENTRIES.map((entry) => entry.id),
    );

    const tree = groupsFor(superAdmin, fullConfig);
    expect(tree.top.map((entry) => entry.id)).toEqual(["home"]);
    expect(tree.groups.map((group) => group.group)).toEqual([
      "workspace",
      "build",
      "develop",
      "administration",
    ]);
    expect(tree.suppressGroupHeaders).toBe(false);
    // Administration after the keys/feedback moves: users, models, budgets,
    // analytics, variables, configuration.
    expect(
      tree.groups.find((group) => group.group === "administration")?.entries
        .length,
    ).toBe(6);
    expect(
      tree.groups
        .find((group) => group.group === "build")
        ?.entries.map((entry) => entry.id),
    ).toEqual([
      "agents",
      "knowledge",
      "prompts",
      "skills",
      "routines",
      "automation",
      "feedback",
    ]);
    expect(
      tree.groups
        .find((group) => group.group === "develop")
        ?.entries.map((entry) => entry.id),
    ).toEqual(["evals", "explorer", "keys", "token"]);
  });

  it("config flags hide Transcripts / Automation / Send feedback — even for super admins", () => {
    const visible = ids(superAdmin, bareConfig);
    expect(visible).not.toContain("transcripts");
    expect(visible).not.toContain("automation");
    expect(visible).not.toContain("send-feedback");
    expect(visible).toHaveLength(NAV_ENTRIES.length - 3);

    // Flags must be explicitly enabled, not merely present.
    const disabled: NavConfig = {
      transcription: { enabled: false },
      n8n: { enabled: false },
      feedback: { enabled: false },
    };
    expect(ids(superAdmin, disabled)).toEqual(ids(superAdmin, bareConfig));
  });

  it("budget-only account: Administration group survives with exactly Budgets", () => {
    const tree = groupsFor(userWith({ budget_management: "read" }), fullConfig);
    expect(tree.groups.map((group) => group.group)).toEqual([
      "workspace",
      "administration",
    ]);
    expect(
      tree.groups
        .find((group) => group.group === "administration")
        ?.entries.map((entry) => entry.id),
    ).toEqual(["budgets"]);
    expect(tree.suppressGroupHeaders).toBe(false);
  });

  it("P2 hat (agents:w + workflows:w): Home + Workspace + Build, no Develop/Administration beyond interim Models", () => {
    const tree = groupsFor(
      userWith({ agents: "write", workflows: "write" }),
      fullConfig,
    );
    expect(tree.top.map((entry) => entry.id)).toEqual(["home"]);
    expect(tree.groups.map((group) => group.group)).toEqual([
      "workspace",
      "build",
      "administration", // models rides agents:w (interim gate, audit M4)
    ]);
    expect(
      tree.groups
        .find((group) => group.group === "build")
        ?.entries.map((entry) => entry.id),
    ).toEqual([
      "agents",
      "knowledge",
      "prompts",
      "skills",
      "routines",
      "automation",
    ]);
    expect(
      tree.groups
        .find((group) => group.group === "administration")
        ?.entries.map((entry) => entry.id),
    ).toEqual(["models"]);
    expect(tree.suppressGroupHeaders).toBe(false);
  });

  it("P4 hat (api:w + evals:r): Workspace + Develop only — keys lives in Develop now", () => {
    const tree = groupsFor(
      userWith({ api: "write", evals: "read" }),
      fullConfig,
    );
    expect(tree.groups.map((group) => group.group)).toEqual([
      "workspace",
      "develop",
    ]);
    expect(
      tree.groups
        .find((group) => group.group === "develop")
        ?.entries.map((entry) => entry.id),
    ).toEqual(["evals", "explorer", "keys", "token"]);
  });
});

describe("activeEntryFor (§1.3 rule 4: first-segment equality + aliases)", () => {
  it("matches detail/sub-surfaces to their parent entry by first segment", () => {
    expect(activeEntryFor("/agents/edit/123")?.id).toBe("agents");
    expect(activeEntryFor("/chat/my-agent/new")?.id).toBe("chat");
    expect(activeEntryFor("/data/ctx-1/files")?.id).toBe("knowledge");
    expect(activeEntryFor("/evals/cases")?.id).toBe("evals");
    expect(activeEntryFor("/variables/create")?.id).toBe("variables");
    expect(activeEntryFor("/workflows/123")?.id).toBe("routines");
  });

  it("matches /roles and /teams to the Users & access entry via aliases", () => {
    expect(activeEntryFor("/roles")?.id).toBe("users");
    expect(activeEntryFor("/teams/some-team")?.id).toBe("users");
  });

  it("matches the root path to Home", () => {
    expect(activeEntryFor("/")?.id).toBe("home");
  });

  it("matches no entry for /runs (folded into /workflows; route is a redirect)", () => {
    expect(activeEntryFor("/runs")).toBeNull();
  });

  it("never substring-matches (audit H7): /users/data is Users, not Knowledge", () => {
    expect(activeEntryFor("/users/data")?.id).toBe("users");
  });

  it("returns null for routes outside the table", () => {
    expect(activeEntryFor("/login")).toBeNull();
    expect(activeEntryFor("/nonexistent")).toBeNull();
  });
});
