// The declarative navigation table — single source of truth for the sidebar,
// the mobile drawer, the command palette, and route guards (navigation.md §1).
//
// Every row mirrors the table in design/navigation.md §1.2 exactly. Gating can
// never diverge between surfaces again (shell audit rec. 2): everything that
// renders a destination consumes `visibleEntries`/`groupsFor`, everything that
// guards a route consumes the same `requires` via `lib/rights.ts#can`.
//
// Pure module: no JSX, no React — importable from server components
// (route guards) and client components (sidebar, palette) alike.

import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  BookCheck,
  Bot,
  Brain,
  ClipboardType,
  Code,
  Cpu,
  FileAudio,
  FolderOpen,
  House,
  Inbox,
  Key,
  KeyRound,
  ListChecks,
  MessageCircle,
  MessageSquarePlus,
  Palette,
  Settings,
  Sparkles,
  Users,
  Variable,
  Wallet,
  Workflow,
} from "lucide-react";

import { can, type Requirement, type RightsUser } from "@/lib/rights";

/**
 * Persona-altitude groups, top to bottom in descending frequency-of-use and
 * ascending privilege (navigation.md §1.1). `top` is the ungrouped Home row;
 * `personal` is the sidebar footer.
 */
export type NavGroup =
  | "top"
  | "workspace"
  | "build"
  | "develop"
  | "administration"
  | "personal";

/** Backend `/config` switches that gate individual entries (§1.2). */
export type NavConfigFlag = "transcriptions" | "n8n" | "feedback";

/**
 * The minimal `/config` shape the nav needs. `ConfigContextType`
 * (components/shell/config-context.tsx) satisfies it structurally.
 */
export interface NavConfig {
  transcription?: { enabled?: boolean };
  n8n?: { enabled?: boolean };
  feedback?: { enabled?: boolean };
}

export interface NavEntry {
  /** Stable id — used as React key, palette value, and test handle. */
  id: string;
  group: NavGroup;
  /** Absolute route. `null` for dialog-only entries (send-feedback). */
  route: string | null;
  /** Flat key into messages/*.json — label canon: nav label = page H1 = palette entry. */
  i18nKey: string;
  /** lucide component ref (global stroke-width 1, rendered at size-4). */
  icon: LucideIcon;
  /** RBAC predicate, evaluated via lib/rights.ts#can (§1.2 notation). */
  requires: Requirement;
  /** Entry renders only when this backend config flag is enabled. */
  configFlag?: NavConfigFlag;
  /**
   * Additional route patterns that highlight this entry (rendering rule
   * §1.3 #4 — matching is first-segment equality, never substring).
   */
  aliases?: string[];
  /** Reserved for §5 mobile composition (drawer/top-bar special-casing). */
  mobile?: boolean;
}

/**
 * The navigation tree (navigation.md §1.2), row for row.
 *
 * Interim gates (backend role-model extension pending — navigation.md §7
 * "Risks & dependencies"): see the TODO on the `knowledge` and `models` rows.
 */
export const NAV_ENTRIES: readonly NavEntry[] = [
  // — top (ungrouped) —
  {
    id: "home",
    group: "top",
    route: "/",
    i18nKey: "navigation.home",
    icon: House,
    // P1-only accounts get no Home item; for them "/" server-redirects to
    // /chat (dashboard.md routing rule). Elevated users land here post-login.
    requires: "elevated",
  },

  // — Workspace —
  {
    id: "chat",
    group: "workspace",
    route: "/chat",
    i18nKey: "navigation.chat",
    icon: MessageCircle,
    requires: "all",
    aliases: ["/chat/*"],
  },
  {
    id: "projects",
    group: "workspace",
    route: "/projects",
    i18nKey: "navigation.projects",
    icon: FolderOpen,
    requires: "all",
    aliases: ["/projects/*"],
  },
  {
    id: "transcripts",
    group: "workspace",
    route: "/transcriptions",
    i18nKey: "navigation.transcriptions",
    icon: FileAudio,
    requires: "all",
    // Fixes shell audit M3 — the transcription config flag is finally honored.
    configFlag: "transcriptions",
  },

  // — Build —
  {
    id: "agents",
    group: "build",
    route: "/agents",
    i18nKey: "navigation.agents",
    icon: Bot,
    requires: { area: "agents", level: "read" },
    aliases: ["/agents/edit/*"],
  },
  {
    id: "knowledge",
    group: "build",
    route: "/data",
    i18nKey: "navigation.knowledge",
    icon: Brain,
    // TODO(backend role-model): flip to { area: "knowledge", level: "read" }
    // once the backend ships the `knowledge` role key (navigation.md §1.2 —
    // spec gate `SA || role.knowledge:r+`, interim `SA || role.agents:r+`).
    requires: { area: "agents", level: "read" },
    // Long-term route rename /data → /knowledge rides Phase 1C (audit rec. 9).
    aliases: ["/data/*"],
  },
  {
    id: "prompts",
    group: "build",
    route: "/prompts",
    i18nKey: "navigation.prompts",
    icon: ClipboardType,
    // Route stays open to all by URL — P1's "use" path lives in the chat
    // composer's prompt selector, not the sidebar (prompts.md row 1).
    requires: { area: "agents", level: "read" },
  },
  {
    id: "skills",
    group: "build",
    route: "/skills",
    i18nKey: "navigation.skills",
    icon: Sparkles,
    requires: { area: "agents", level: "write" },
  },
  {
    id: "routines",
    group: "build",
    route: "/workflows",
    i18nKey: "navigation.routines",
    icon: ListChecks,
    // Read role gets the item + read-only page (workflows.md row 187).
    requires: { area: "workflows", level: "read" },
  },
  {
    id: "automation",
    group: "build",
    route: "/n8n",
    i18nKey: "navigation.automation",
    icon: Workflow,
    requires: { area: "workflows", level: "read" },
    configFlag: "n8n",
  },

  // — Develop —
  {
    id: "evals",
    group: "develop",
    route: "/evals",
    i18nKey: "navigation.evals",
    icon: BookCheck,
    requires: { area: "evals", level: "read" },
    aliases: ["/evals/[id]", "/evals/cases"],
  },
  {
    id: "explorer",
    group: "develop",
    route: "/explorer",
    i18nKey: "navigation.apiExplorer",
    icon: Code,
    // Evaluable once `api` is populated in serverSideAuthCheck (explorer.md U2).
    requires: { area: "api", level: "write" },
  },
  {
    id: "token",
    group: "develop",
    route: "/token",
    i18nKey: "navigation.personalToken",
    icon: KeyRound,
    // Moved out of the every-user dropdown (keys-token.md row 23). Route stays
    // URL-accessible for all — placement fix, not an access change.
    requires: { area: "api", level: "read" },
  },

  // — Administration —
  {
    id: "users",
    group: "administration",
    route: "/users",
    i18nKey: "navigation.usersAccess",
    icon: Users,
    requires: { area: "users", level: "write" },
    // One entry for the whole identity area; /roles and /teams are tabs of it
    // (access.md; fixes shell audit M5).
    aliases: ["/roles", "/teams"],
  },
  {
    id: "models",
    group: "administration",
    route: "/models",
    i18nKey: "navigation.models",
    icon: Cpu,
    // TODO(backend role-model): flip to { area: "models", level: "write" }
    // once the backend ships the `models` role key (navigation.md §1.2 —
    // spec gate `SA || role.models:w`, interim `SA || role.agents:w`,
    // recorded as backend dependency, shell audit M4).
    requires: { area: "agents", level: "write" },
  },
  {
    id: "budgets",
    group: "administration",
    route: "/budgets",
    i18nKey: "navigation.budgets",
    icon: Wallet,
    // Read-scoped roles are the legitimate secondary audience (budgets.md).
    requires: { area: "budget_management", level: "read" },
  },
  {
    id: "analytics",
    group: "administration",
    route: "/analytics",
    i18nKey: "navigation.analytics",
    icon: BarChart3,
    // A future `role.analytics:r+` opens a P2 path without IA change.
    requires: "super_admin",
  },
  {
    id: "variables",
    group: "administration",
    route: "/variables",
    i18nKey: "navigation.variables",
    icon: Variable,
    // Label unified ("Vault" retired); read role gets a read-only page.
    requires: { area: "variables", level: "read" },
    aliases: ["/variables/*"],
  },
  {
    id: "keys",
    group: "administration",
    route: "/keys",
    i18nKey: "navigation.apiKeys",
    icon: Key,
    requires: { area: "api", level: "write" },
  },
  {
    id: "feedback",
    group: "administration",
    route: "/feedback",
    i18nKey: "navigation.feedback",
    icon: Inbox,
    // TODO(backend role-model): flip to a `feedback` role key when it ships
    // (navigation.md §1.2 — "SA (future role.feedback)"). This is the P3
    // review console; icon deliberately differs from the footer's
    // "Send feedback" (the name is split, the surfaces stay).
    requires: "super_admin",
  },
  {
    id: "configuration",
    group: "administration",
    route: "/configuration",
    i18nKey: "navigation.configuration",
    icon: Palette,
    // Label canon: "Configuration", not "Theme" (it owns more than theming).
    requires: "super_admin",
  },

  // — Personal (footer) —
  {
    id: "send-feedback",
    group: "personal",
    route: null, // opens the FeedbackDialog, deliberately no route
    i18nKey: "navigation.sendFeedback",
    icon: MessageSquarePlus,
    requires: "all",
    configFlag: "feedback",
  },
  {
    id: "settings",
    group: "personal",
    route: "/settings",
    i18nKey: "navigation.settings",
    icon: Settings,
    requires: "all",
  },
  // The user menu (avatar row) is shell chrome, not a NavEntry (§1.2).
];

/** Group header label keys (`navigation.groups.*`). `top` has no header. */
export const GROUP_I18N_KEYS: Record<Exclude<NavGroup, "top">, string> = {
  workspace: "navigation.groups.workspace",
  build: "navigation.groups.build",
  develop: "navigation.groups.develop",
  administration: "navigation.groups.administration",
  personal: "navigation.groups.personal",
};

/** Canonical order of the grouped sidebar body (§1.1 principle 1). */
const BODY_GROUPS: readonly Exclude<NavGroup, "top" | "personal">[] = [
  "workspace",
  "build",
  "develop",
  "administration",
];

function flagEnabled(config: NavConfig, flag?: NavConfigFlag): boolean {
  if (!flag) return true;
  switch (flag) {
    case "transcriptions":
      return config.transcription?.enabled === true;
    case "n8n":
      return config.n8n?.enabled === true;
    case "feedback":
      return config.feedback?.enabled === true;
  }
}

/**
 * Every entry the given account may see: RBAC predicate AND config flags
 * (rendering rule §1.3 #1). Order is the table's canonical order.
 */
export function visibleEntries(user: RightsUser, config: NavConfig): NavEntry[] {
  return NAV_ENTRIES.filter(
    (entry) => can(user, entry.requires) && flagEnabled(config, entry.configFlag),
  );
}

export interface NavGroupView {
  group: Exclude<NavGroup, "top" | "personal">;
  entries: NavEntry[];
}

export interface SidebarTree {
  /** Ungrouped rows above the groups (Home) — empty for P1-only accounts. */
  top: NavEntry[];
  /** Body groups in canonical order; a group renders iff ≥1 visible item. */
  groups: NavGroupView[];
  /**
   * Rendering rule §1.3 #2 — exactly one body group survives (Workspace),
   * so its header label is suppressed and P1's sidebar reads as a flat app.
   */
  suppressGroupHeaders: boolean;
  /** Footer rows (Send feedback, Settings) — the user menu is not an entry. */
  personal: NavEntry[];
}

/**
 * The grouped sidebar/drawer tree for an account, implementing the normative
 * rendering rules of navigation.md §1.3 (group trims, header suppression).
 */
export function groupsFor(user: RightsUser, config: NavConfig): SidebarTree {
  const visible = visibleEntries(user, config);
  const groups = BODY_GROUPS.map((group) => ({
    group,
    entries: visible.filter((entry) => entry.group === group),
  })).filter((view) => view.entries.length > 0);

  return {
    top: visible.filter((entry) => entry.group === "top"),
    groups,
    suppressGroupHeaders: groups.length === 1,
    personal: visible.filter((entry) => entry.group === "personal"),
  };
}

function firstSegment(path: string): string {
  return path.split("/").filter(Boolean)[0] ?? "";
}

/**
 * Active-state matching (rendering rule §1.3 #4): first-segment equality plus
 * the alias list — never substring matching (fixes shell audit H7).
 * Returns the entry that owns `pathname`, or null (e.g. /login).
 */
export function activeEntryFor(pathname: string): NavEntry | null {
  const segment = firstSegment(pathname);
  if (segment === "") {
    return NAV_ENTRIES.find((entry) => entry.route === "/") ?? null;
  }
  return (
    NAV_ENTRIES.find((entry) => {
      if (entry.route && entry.route !== "/" && firstSegment(entry.route) === segment) {
        return true;
      }
      return entry.aliases?.some((alias) => firstSegment(alias) === segment) ?? false;
    }) ?? null
  );
}
