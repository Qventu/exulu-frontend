import { describe, expect, it } from "vitest";

import {
  GET_AGENTS_WITH_BUDGETS,
  GET_PROJECTS_WITH_BUDGETS,
  GET_ROLES_WITH_BUDGETS,
  GET_TEAMS_WITH_BUDGETS,
  GET_USERS_WITH_BUDGETS,
  GET_WORKFLOW_TEMPLATES_WITH_BUDGETS,
} from "@/app/(application)/budgets/queries";
import {
  GET_AGENTS_BY_IDS,
  GET_PROJECTS_BY_IDS,
  GET_ROLES_BY_IDS,
  GET_ROUTINES_BY_IDS,
  GET_TEAMS_BY_IDS,
  GET_USERS_BY_IDS,
} from "@/app/(application)/analytics/queries";

import { DIMENSION_TAG_PREFIX } from "@/app/(application)/analytics/lens";

import { kostenChapter } from "./chapters/kosten";
import {
  allocateSpend,
  KOSTEN_MONTHLY_SPEND,
  KOSTEN_ROSTERS,
  KOSTEN_TEAMS,
} from "./fixtures/chapter-kosten";
import { DEMO_RESOLVERS } from "./resolvers";
import {
  runDemoOperation as run,
  runDemoQueryThroughCache as runThroughCache,
} from "./test-support";

/** The allocation GetTeamsWithBudgets must agree with. */
const EXPECTED_TEAM_SPEND = allocateSpend(
  KOSTEN_MONTHLY_SPEND,
  KOSTEN_TEAMS.map((t) => t.share),
);

const world = { agents: [], contexts: [], items: [], sessions: [] } as never;

describe("budgets resolvers", () => {
  it("returns the same teams the analytics fixture attributes spend to", () => {
    const data = DEMO_RESOLVERS.GetTeamsWithBudgets(world, { page: 1, limit: 25 }) as {
      teamsPagination: { items: Array<{ id: string; name: string; budget: unknown }> };
    };
    expect(data.teamsPagination.items.map((t) => t.name)).toEqual(
      KOSTEN_TEAMS.map((t) => t.name),
    );
  });

  // allocateProportional absorbs any rounding error from shares that don't
  // sum to 1 silently — it hands the leftover (or missing) cents out
  // round-robin by array order, so every reconciliation test above stays
  // green even while the displayed split stops matching the declared shares,
  // identically on both /analytics and /budgets. Nothing else pins this.
  it("KOSTEN_TEAMS' shares sum to 1", () => {
    const total = KOSTEN_TEAMS.reduce((sum, team) => sum + team.share, 0);
    expect(Math.abs(total - 1)).toBeLessThan(1e-9);
  });
});

/**
 * Coverage tests: run the REAL /budgets and /analytics query documents
 * through the demo link, so a renamed or reshaped root field fails HERE
 * rather than silently emptying a table on the demo. Same pattern as
 * apollo-link.operations.test.ts.
 *
 * lib/** may not import the legacy queries/queries.ts monolith directly
 * (codebase-structure §1.2 / eslint.config.mjs tier-lib zone), so these
 * documents are imported from the route-local `queries.ts` re-export files
 * instead — the same thing apollo-link.operations.test.ts already does for
 * agents/edit and data. Only the monolith import specifier itself is
 * banned; importing a feature's own colocated queries.ts is not.
 *
 * The existence checks above were the plan's original test — worth keeping,
 * but weak: a resolver can exist and still answer the wrong root field,
 * which Apollo's cache turns into `data: undefined` (an empty table, no
 * error). These tests exercise the actual shape instead.
 *
 * Two ways of running a document, deliberately not interchangeable:
 *
 *   - runDemoQueryThroughCache — for the POPULATED cases (GetTeamsWithBudgets,
 *     GetTeamsByIds). It goes through a real ApolloClient + InMemoryCache,
 *     which diffs the resolver's result against the selection set. A row
 *     missing a field the query selects — e.g. a future item added to
 *     KOSTEN_TEAMS without a `budget`, or the `spend: 0` regression this
 *     round of review caught — fails HERE, the same way an incomplete cache
 *     write silently hands the real component `data: undefined` on screen.
 *     runDemoOperation cannot catch that: per its own docstring
 *     (test-support.ts), execute() "hands back whatever the resolver
 *     returned", so a field-incomplete item would pass it.
 *
 *   - runDemoOperation — for the nine DELIBERATELY EMPTY operations. An
 *     empty array has no item to be field-incomplete, so there is nothing
 *     for a cache diff to catch that execute() would miss; the only thing
 *     worth pinning is the root field name, which runDemoOperation already
 *     asserts by reading `data[root]`.
 */
describe("/budgets page operations answer the shape the queries ask for", () => {
  it("answers GetTeamsWithBudgets with the KOSTEN_TEAMS roster, through the cache", async () => {
    // Through the cache, not execute(): a row missing a selected field (id,
    // name, or budget) would leave `data` undefined here, which is exactly
    // how this failure is silent on the real /budgets screen.
    const data = await runThroughCache(GET_TEAMS_WITH_BUDGETS, {
      page: 1,
      limit: 25,
      filters: [],
    });
    const wrapper = data.teamsPagination as {
      pageInfo: unknown;
      items: Array<{ id: string; name: string; budget: { max_budget: number; spend: number } }>;
    };
    expect(wrapper.pageInfo).toBeTruthy();
    expect(wrapper.items.map((t) => t.id)).toEqual(KOSTEN_TEAMS.map((t) => t.id));
    expect(wrapper.items.map((t) => t.name)).toEqual(KOSTEN_TEAMS.map((t) => t.name));
    // Pins the Finding-1 fix: spend must track KOSTEN_TEAMS.share, the same
    // field the /analytics REST fixture allocates by — not a flat 0, which
    // silently zeroed every team's projected usage and emptied the
    // budgets-at-risk section.
    expect(wrapper.items.map((t) => t.budget.spend)).toEqual(EXPECTED_TEAM_SPEND);
  });

  it.each([
    ["GetUsersWithBudgets", GET_USERS_WITH_BUDGETS, "usersPagination"],
    ["GetRolesWithBudgets", GET_ROLES_WITH_BUDGETS, "rolesPagination"],
    ["GetProjectsWithBudgets", GET_PROJECTS_WITH_BUDGETS, "projectsPagination"],
    ["GetAgentsWithBudgets", GET_AGENTS_WITH_BUDGETS, "agentsPagination"],
    [
      "GetWorkflowTemplatesWithBudgets",
      GET_WORKFLOW_TEMPLATES_WITH_BUDGETS,
      "workflow_templatesPagination",
    ],
  ] as const)("answers %s under its real root field %s", async (_op, document, root) => {
    const data = await run(document, { page: 1, limit: 25, filters: [] });
    const wrapper = data[root] as { pageInfo: unknown; items: unknown[] };
    expect(wrapper, `missing root field: ${root}`).toBeTruthy();
    expect(wrapper.pageInfo).toBeTruthy();
    expect(Array.isArray(wrapper.items)).toBe(true);
  });
});

describe("/analytics breakdown card id-hydration operations", () => {
  it("answers GetTeamsByIds under teamsPagination.items with the KOSTEN_TEAMS roster, through the cache", async () => {
    const data = await runThroughCache(GET_TEAMS_BY_IDS, {
      ids: KOSTEN_TEAMS.map((t) => t.id),
    });
    const items = (data.teamsPagination as { items: Array<{ id: string; name: string }> })
      .items;
    expect(items.map((t) => t.id)).toEqual(KOSTEN_TEAMS.map((t) => t.id));
    expect(items.map((t) => t.name)).toEqual(KOSTEN_TEAMS.map((t) => t.name));
  });

  it("answers GetRoutinesByIds under workflow_templatesPagination.items", async () => {
    const data = await run(GET_ROUTINES_BY_IDS, { ids: [] });
    const items = (data.workflow_templatesPagination as { items: unknown[] }).items;
    expect(Array.isArray(items)).toBe(true);
  });

  it("answers GetRolesByIds under rolesPagination.items", async () => {
    const data = await run(GET_ROLES_BY_IDS, {});
    const items = (data.rolesPagination as { items: unknown[] }).items;
    expect(Array.isArray(items)).toBe(true);
  });

  it("answers GetUsersByIds under the flat userByIds array", async () => {
    const data = await run(GET_USERS_BY_IDS, { ids: [] });
    expect(Array.isArray(data.userByIds)).toBe(true);
  });

  it("answers GetProjectsByIds under the flat projectByIds array", async () => {
    const data = await run(GET_PROJECTS_BY_IDS, { ids: [] });
    expect(Array.isArray(data.projectByIds)).toBe(true);
  });

  it("answers GetAgentsByIds under the flat agentByIds array (already mapped)", async () => {
    const data = await run(GET_AGENTS_BY_IDS, { ids: [] });
    expect(Array.isArray(data.agentByIds)).toBe(true);
  });
});

/**
 * The chapter's routes against the data behind them.
 *
 * Both product screens default to a view this tour has NO data for —
 * /analytics to dimension=agents, /budgets to type=user — and both fail
 * QUIETLY, with an empty-state card rather than an error: "Keine Daten für
 * diese Ansicht" under a step claiming you can see what was spent on, and
 * "Noch keine Budgets" under one claiming every team has a limit. Nothing
 * throws, nothing logs, and the suite was green while the chapter's own
 * screens contradicted it. So the query parameters that fix that are pinned
 * to the fixtures that make them true, not left as string literals a later
 * edit can drop.
 */
describe("chapter 11's routes land on views the fixtures populate", () => {
  const paramOf = (route: string, key: string) =>
    new URLSearchParams(route.split("?")[1] ?? "").get(key);

  it("sends /analytics to a dimension KOSTEN_ROSTERS has a roster for", () => {
    const steps = kostenChapter.steps.filter((s) => s.route.startsWith("/analytics"));
    expect(steps.length).toBeGreaterThan(0);
    for (const step of steps) {
      const dimension = paramOf(step.route, "dimension");
      expect(dimension, `${step.id} must pin a dimension`).toBeTruthy();
      const prefix = DIMENSION_TAG_PREFIX[dimension as keyof typeof DIMENSION_TAG_PREFIX];
      expect(prefix, `${step.id}: unknown dimension ${dimension}`).toBeTruthy();
      expect(KOSTEN_ROSTERS[prefix] ?? [], `${step.id}: ${prefix} roster`).not.toHaveLength(0);
    }
  });

  it("sends /budgets to an entity tab whose resolver returns rows", () => {
    const byTab: Record<string, string> = {
      user: "GetUsersWithBudgets",
      role: "GetRolesWithBudgets",
      team: "GetTeamsWithBudgets",
      project: "GetProjectsWithBudgets",
      agent: "GetAgentsWithBudgets",
      workflow_template: "GetWorkflowTemplatesWithBudgets",
    };
    const steps = kostenChapter.steps.filter((s) => s.route.startsWith("/budgets"));
    expect(steps.length).toBeGreaterThan(0);
    for (const step of steps) {
      const tab = paramOf(step.route, "type");
      expect(tab, `${step.id} must pin an entity tab`).toBeTruthy();
      const op = byTab[tab as string];
      expect(op, `${step.id}: unknown tab ${tab}`).toBeTruthy();
      const data = DEMO_RESOLVERS[op](world, { page: 1, limit: 25 }) as Record<
        string,
        { items: unknown[] }
      >;
      const items = Object.values(data)[0].items;
      expect(items, `${step.id}: ${op} rows`).not.toHaveLength(0);
    }
  });
});
