import { CONTEXT_SEARCH_TOOL, AGENTIC_RETRIEVAL_TOOL } from "./fixtures/agent-editor";
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
