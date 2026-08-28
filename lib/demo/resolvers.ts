import { CONTEXT_SEARCH_TOOL, AGENTIC_RETRIEVAL_TOOL } from "./fixtures/agent-editor";
import { EVAL_RUNS, EVAL_SETS, TEST_CASES } from "./fixtures/evals";
import { DEMO_USER_ID } from "./user";
import type { DemoWorld } from "./types";

/**
 * The single demo resolver table, shared by BOTH transports:
 *
 *   - createDemoLink            → client-side Apollo
 *   - fetchGraphQLServerSide    → server components
 *
 * Sharing matters. Detail routes (agents/edit/[id], chat/[agent]/*,
 * workflows/[id], prompts/[id], data/[ctx]) fetch on the server, index routes
 * fetch on the client. An earlier attempt gave the demo its own parallel pages
 * for the server-rendered ones, which meant maintaining a second copy of every
 * detail screen — duplication that drifts from the product and undermines the
 * point of rendering the real thing. One table behind both transports means a
 * chapter works on the product's own route regardless of where it fetches.
 *
 * Keys MUST be the operation names in the product's own gql documents.
 * apollo-link.operations.test.ts imports those documents and asserts coverage,
 * so a renamed or reshaped query fails at test time rather than silently
 * emptying a chapter.
 */

export type DemoResolver = (
  world: DemoWorld,
  variables: Record<string, unknown>,
) => Record<string, unknown>;

/** Every *Pagination selection includes pageInfo; the tables read it. */
const page = (itemCount: number) => ({
  pageCount: 1,
  itemCount,
  currentPage: 1,
  hasPreviousPage: false,
  hasNextPage: false,
});

/**
 * Pulls an eval_set_id out of the product's filter argument shape, which is a
 * list of `{ field: { operator: value } }`-ish entries rather than a flat map.
 * Returns null when unfiltered.
 */
function evalSetIdFrom(variables: Record<string, unknown>): string | null {
  const filters = variables?.filters;
  if (!Array.isArray(filters)) return null;
  for (const filter of filters) {
    const candidate = (filter as { eval_set_id?: unknown })?.eval_set_id;
    if (typeof candidate === "string") return candidate;
    if (candidate && typeof candidate === "object") {
      const nested = Object.values(candidate as Record<string, unknown>).find(
        (v) => typeof v === "string",
      );
      if (typeof nested === "string") return nested;
    }
  }
  return null;
}

export const DEMO_RESOLVERS: Record<string, DemoResolver> = {
  // --- app shell (every page) ---------------------------------------------
  // The sidebar polls this on every route, so it is shell-wide rather than
  // chapter-specific. Zero is the truth for a tour with no live runs.
  RoutineRunsNeedingAttentionCount: () => ({
    routineRunsNeedingAttentionCount: 0,
  }),

  // --- /data (chapter 2: document understanding) --------------------------
  // Note the nesting: GetContexts selects `contexts { items { ... } }`, so a
  // flat array would satisfy TypeScript and render nothing.
  GetContexts: (world) => ({ contexts: { items: world.contexts } }),

  GetContextIcons: () => ({ platform_configurationsPagination: { items: [] } }),

  GetUserContextItemFavourites: () => ({
    userById: {
      id: String(DEMO_USER_ID),
      favourite_items: [],
      recently_viewed_items: [],
    },
  }),

  // --- /evals (chapter 5: proving accuracy) -------------------------------
  // All three are *Pagination wrappers; pageInfo is selected, so omitting it
  // leaves the tables unable to render their footers.
  GetEvalSets: () => ({
    eval_setsPagination: {
      pageInfo: page(EVAL_SETS.length),
      items: EVAL_SETS,
    },
  }),

  GetTestCases: (_world, variables) => {
    // The cases library is filtered by eval set when opened from a set. Honour
    // it: an unfiltered list would show the regulatory case inside the techdoc
    // suite, which is exactly the mistake the suite exists to catch.
    const setId = evalSetIdFrom(variables);
    const items = setId
      ? TEST_CASES.filter((c) => c.eval_set_id === setId)
      : TEST_CASES;
    return {
      test_casesPagination: { pageInfo: page(items.length), items },
    };
  },

  GetEvalRuns: (_world, variables) => {
    const setId = evalSetIdFrom(variables);
    const items = setId
      ? EVAL_RUNS.filter((r) => r.eval_set_id === setId)
      : EVAL_RUNS;
    return {
      eval_runsPagination: { pageInfo: page(items.length), items },
    };
  },

  // --- server-rendered detail routes --------------------------------------
  // These reach fetchGraphQLServerSide rather than Apollo. They were found by
  // the unmapped-operation warning firing on the server, which is exactly what
  // that warning is for.
  GetAgentById: (world) => ({ agentById: world.agents[0] }),

  GetAgents: (world) => ({
    agentsPagination: {
      pageInfo: { pageCount: 1, itemCount: world.agents.length },
      items: world.agents,
    },
  }),

  GetContextById: (world, variables) => ({
    contextById:
      world.contexts.find((c) => c.id === variables.id) ?? world.contexts[0],
  }),

  // --- /agents/edit/[id] (chapter 3: agent configuration) -----------------
  AgentEditorById: (world) => ({
    agentById: {
      ...world.agents[0],
      tools: [CONTEXT_SEARCH_TOOL],
      skills: [],
      capabilities: {
        text: true,
        images: true,
        files: true,
        audio: false,
        video: false,
      },
      RBAC: { type: "agent", users: [], roles: [] },
    },
  }),

  EditorContexts: (world) => ({
    contexts: {
      items: world.contexts.map(({ id, name, description }) => ({
        id,
        name,
        description,
      })),
    },
  }),

  // The Agentic retrieval card renders only when a tool with the id
  // `agentic_context_search` exists on the DEPLOYMENT, not merely on the agent
  // (sections/knowledge.tsx:44). Returning an empty catalogue here is what hid
  // the wizard — the chapter's entire subject — while the page itself looked
  // fine.
  EditorTools: () => ({ tools: { items: [AGENTIC_RETRIEVAL_TOOL] } }),

  EditorToolCategories: () => ({ toolCategories: ["knowledge"] }),
  EditorSkills: () => ({ skillsPagination: { items: [] } }),
  EditorVariables: () => ({ variablesPagination: { items: [] } }),
};

/**
 * Reads the operation name from either a gql DocumentNode or a raw query
 * string. fetchGraphQLServerSide is typed `query: string` but callers pass
 * DocumentNodes, so both shapes reach us.
 */
export function operationNameOf(query: unknown): string | null {
  if (typeof query === "string") {
    return /(?:query|mutation)\s+([A-Za-z_][A-Za-z0-9_]*)/.exec(query)?.[1] ?? null;
  }
  const definitions = (query as { definitions?: unknown[] })?.definitions;
  if (!Array.isArray(definitions)) return null;
  for (const def of definitions) {
    const name = (def as { name?: { value?: string } })?.name?.value;
    if (name) return name;
  }
  return null;
}
