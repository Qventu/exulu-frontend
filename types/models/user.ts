// OWNERSHIP (Phase 0, codebase-structure D6): hand-maintained GraphQL model types.
// This directory is the explicit type source until GraphQL codegen lands
// (lib/graphql/__generated__/, see codegen.ts); then features migrate to generated
// types per-feature and this file is deleted. Keep in sync with the backend schema.

export type User = {
  id: number;
  email: string;
  emailVerified?: string;
  // "external" = self-registered public-agents guest (spec §4.2); such rows are
  // fenced out of internal API routes (e.g. app/api/feedback/[kind]/route.ts).
  type?: "api" | "user" | "external"
  super_admin?: boolean;
  favourite_agents?: string[];
  favourite_projects?: string[];
  /** Favourited data items — global ids ("<contextId>/<itemId>"). */
  favourite_items?: string[];
  /** Recently viewed data items — global ids, most-recent first. */
  recently_viewed_items?: string[];
  personal_system_prompt?: string;
  role: string;
  team?: string;
};

export type UserBudgetView = {
  spend: number;
  max_budget: number;
  budget_duration: string | null;
  budget_reset_at: string | null;
  /** "amount" → show exact USD; "percent" → show only a percentage. Mirrors
   *  the platform `user_budget_display` setting. */
  display?: "amount" | "percent";
};

export type UserWithRole = User & {
  role: {
    id: string;
    name: string;
    agents: "read" | "write";
    workflows: "read" | "write";
    evals: "read" | "write";
    variables: "read" | "write";
    users: "read" | "write";
    budget_management?: "read" | "write";
  }
  /**
   * Live LiteLLM budget snapshot, attached in serverSideAuthCheck when the
   * "show user budget in chat" admin setting is on. Null/absent otherwise.
   */
  budget?: UserBudgetView | null;
};
