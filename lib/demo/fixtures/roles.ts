/**
 * The roles roster the agent editor's access control lists (RBACControl
 * queries GetUserRoles, page 1 / limit 100). Chapter 4 shares the assistant
 * with "Techniker"; the other two are there so the list reads as a workspace
 * rather than a stub. Every field is one GetUserRoles selects
 * (queries/queries.ts): an absent selected field is an Apollo cache error.
 *
 * Teams were the spec's first choice. The product cannot share an agent with
 * a team — AGENT_RBAC_TEAMS_SUPPORTED is false because the backend's RBACData
 * has no `teams` field — so a teams-shared agent would have shown a
 * capability that does not exist.
 */
export const ROLE_TECHNIKER_ID = "role-techniker";

const role = (id: string, name: string) => ({
  id,
  name,
  createdAt: "2026-06-11T08:00:00.000Z",
  updatedAt: "2026-06-11T08:00:00.000Z",
  agents: "read",
  workflows: "read",
  api: "read",
  variables: "read",
  users: "read",
  evals: "read",
  budget_management: "read",
});

export const DEMO_ROLES = [
  role(ROLE_TECHNIKER_ID, "Techniker"),
  role("role-service", "Servicetechniker"),
  role("role-vertrieb", "Vertrieb"),
];
