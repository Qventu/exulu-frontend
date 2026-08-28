import { CONTEXT_SEARCH_TOOL, AGENTIC_RETRIEVAL_TOOL } from "./fixtures/agent-editor";
import { MEMORY_SESSION_ID } from "./fixtures/chapter-memory";
import { CONTEXTS } from "./fixtures/contexts";
import { EVAL_RUNS, EVAL_SETS, TEST_CASES } from "./fixtures/evals";
import {
  MEMORY_SCROLLBACK,
  MEMORY_SCROLLBACK_ROWS,
} from "./fixtures/memory-turns";
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

const KNOWN_CONTEXT_IDS = new Set(CONTEXTS.map((c) => c.id));

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

/** Reads a `{ field: { eq: value } }`-style filter argument. */
function filterValue(
  variables: Record<string, unknown>,
  field: string,
): string | null {
  const filters = variables?.filters;
  const list = Array.isArray(filters) ? filters : filters ? [filters] : [];
  for (const filter of list) {
    const candidate = (filter as Record<string, unknown>)?.[field];
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

/**
 * The scripted conversation history, as `agent_messages` rows. Only chapter
 * 4's session has scrollback; every other session opens empty and the whole
 * conversation is streamed live by DemoChatTransport.
 */
function scrollbackRows(variables: Record<string, unknown>) {
  const sessionId = filterValue(variables, "session");
  if (sessionId && sessionId !== MEMORY_SESSION_ID) return [];
  return MEMORY_SCROLLBACK.map((message, index) => ({
    ...MEMORY_SCROLLBACK_ROWS[index],
    content: JSON.stringify(message),
  }));
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

  // --- /data/[ctx]/items/[itemId] (chapter 2: ingestion) ------------------
  // The item detail page polls this every 5s to drive the pipeline stepper.
  // Empty is the truth and also what we want on screen: an empty list means no
  // stage is in flight, so the stepper renders all four stages settled rather
  // than showing a spinner that never resolves in a world with no workers.
  GetItemActiveJobs: () => ({
    job_resultsPagination: { items: [] },
  }),

  // Derived from the fixture rather than hardcoded, so the health panel cannot
  // drift from the documents the list is showing. stuck/stale are zero because
  // nothing is stuck or stale in a scripted world — inventing a non-zero count
  // would put a warning badge on the screen whose point is a healthy pipeline.
  GetContextHealth: (world, variables) => {
    const id = String(variables.id ?? "");
    const items = world.itemsByContext?.[id] ?? world.items;
    return {
      contextById: {
        id,
        item_count: items.length,
        chunk_total: items.reduce(
          (sum, item) => sum + (item.chunks_count ?? 0),
          0,
        ),
        stuck_count: 0,
        stale_count: 0,
      },
    };
  },

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
  // total/page/limit are selected alongside items. Omitting them is not
  // cosmetic here: an incomplete cache diff can leave useQuery with undefined
  // data, and undefined data hides the card that IS chapter 3.
  EditorTools: () => ({
    tools: {
      items: [AGENTIC_RETRIEVAL_TOOL],
      total: 1,
      page: 1,
      limit: 20,
    },
  }),

  EditorToolCategories: () => ({ toolCategories: ["knowledge"] }),

  // Empty lists still need their pageInfo: it is in the selection set, and a
  // *Pagination wrapper without it writes an incomplete result to the cache.
  EditorSkills: () => ({ skillsPagination: { pageInfo: page(0), items: [] } }),
  EditorVariables: () => ({
    variablesPagination: { pageInfo: page(0), items: [] },
  }),

  // --- /chat/[agent]/[session] (chapters 1 and 4) -------------------------
  // Both are server-rendered by the real chat route.
  GetAgentSessionById: (world, variables) => ({
    agent_sessionById:
      world.sessions.find((s) => s.id === variables.id) ?? world.sessions[0],
  }),

  // `content` is a JSON STRING: the page does JSON.parse(item.content) to get
  // back a UIMessage. Returning an object here throws inside the page.
  //
  // The page requests DESC and then reverses, so honour the sort direction
  // rather than assuming — feedback-detail-panel.tsx asks for the same
  // operation and would otherwise render the conversation backwards.
  GetAgentSessionMessages: (_world, variables) => {
    const rows = scrollbackRows(variables);
    const direction = (
      (variables?.sort as { direction?: string })?.direction ?? "ASC"
    ).toUpperCase();
    const items = direction === "DESC" ? [...rows].reverse() : rows;
    return {
      agent_messagesPagination: { pageInfo: page(items.length), items },
    };
  },
};

/**
 * Per-context item operations are GENERATED, not written by hand: /data/[ctx]
 * builds `query <ctx>Pagination` and `query <ctx>ById` from the context id at
 * runtime (data/queries.ts GET_ITEMS / GET_ITEM_BY_ID). There is no fixed set
 * of names to enumerate, so these are matched by shape instead — which means
 * every knowledge base in the tour gets a working detail page, not just the
 * ones somebody remembered to add.
 *
 * Note the response field is `<ctx>_itemsPagination` while the OPERATION is
 * `<ctx>Pagination`. They differ, and returning the operation name as the field
 * yields a page that renders its empty state.
 */
function dynamicResolver(operationName: string): DemoResolver | undefined {
  // Gated on the real context ids rather than matching any `<x>Pagination`.
  // A loose pattern would quietly answer operations nobody has mapped, and the
  // unmapped-operation warning is the diagnostic that has caught every missing
  // resolver so far (GetAgentById, GetAgents, RoutineRunsNeedingAttentionCount).
  // Silencing it to save a few lines would be a bad trade.
  const isContext = (id: string) => KNOWN_CONTEXT_IDS.has(id);

  const paginationMatch = /^([a-z0-9_]+)Pagination$/.exec(operationName);
  if (paginationMatch && isContext(paginationMatch[1])) {
    const ctx = paginationMatch[1];
    return (world) => {
      const items = world.itemsByContext?.[ctx] ?? world.items;
      return {
        [`${ctx}_itemsPagination`]: { pageInfo: page(items.length), items },
      };
    };
  }

  const byIdMatch = /^([a-z0-9_]+)ById$/.exec(operationName);
  if (byIdMatch && isContext(byIdMatch[1])) {
    const ctx = byIdMatch[1];
    return (world, variables) => {
      const items = world.itemsByContext?.[ctx] ?? world.items;
      return {
        [`${ctx}_itemsById`]:
          items.find((i) => i.id === variables.id) ?? items[0] ?? null,
      };
    };
  }

  return undefined;
}

/**
 * The single lookup both transports use: explicit table first, generated
 * operations second. Returns undefined when nothing matches, which the callers
 * turn into a warning plus an empty result.
 */
export function resolverFor(
  operationName: string | null,
): DemoResolver | undefined {
  if (!operationName) return undefined;
  return DEMO_RESOLVERS[operationName] ?? dynamicResolver(operationName);
}

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
