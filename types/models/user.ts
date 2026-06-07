export type User = {
  id: number;
  email: string;
  emailVerified?: string;
  type?: "api" | "user"
  super_admin?: boolean;
  favourite_agents?: string[];
  favourite_projects?: string[];
  personal_system_prompt?: string;
  role: string;
  team?: string;
};

export type UserBudgetView = {
  spend: number;
  max_budget: number;
  budget_duration: string | null;
  budget_reset_at: string | null;
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
