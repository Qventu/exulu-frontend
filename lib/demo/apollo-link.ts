import { ApolloLink, Observable } from "@apollo/client/core";
import { CONTEXT_SEARCH_TOOL } from "./fixtures/agent-editor";
import { DEMO_USER_ID } from "./user";
import type { DemoWorld } from "./types";

type Resolver = (world: DemoWorld, variables: Record<string, unknown>) => Record<string, unknown>;

/**
 * Operation name -> resolver.
 *
 * Keys MUST be the operation names in the product's own gql documents, because
 * that is what Apollo puts on `operation.operationName`. The first version of
 * this table was written from plausible-looking guesses (`contexts`, `agents`,
 * `items`) before any page was checked, and every single one was wrong — the
 * pages rendered empty for weeks because unmapped operations return `{data:{}}`
 * rather than failing. apollo-link.operations.test.ts now imports the real
 * documents so that mistake cannot recur silently.
 *
 * Response shapes must match the query's selection set exactly, nesting
 * included: GetContexts selects `contexts { items { ... } }`, so a flat array
 * would satisfy TypeScript and render nothing.
 */
const RESOLVERS: Record<string, Resolver> = {
  // --- /data (chapter 2: document understanding) --------------------------
  GetContexts: (world) => ({ contexts: { items: world.contexts } }),

  // Per-context icon overrides live in platform configuration. The demo ships
  // none, so the page falls back to its default icons — an empty page is the
  // correct answer here, not a missing one.
  GetContextIcons: () => ({ platform_configurationsPagination: { items: [] } }),

  // Favourites and recently-viewed are per-user personalisation the tour has
  // no story for; empty lists keep the library rendering unadorned.
  GetUserContextItemFavourites: () => ({
    userById: {
      id: String(DEMO_USER_ID),
      favourite_items: [],
      recently_viewed_items: [],
    },
  }),

  // --- /agents/edit/[id] (chapter 3: agent configuration) -----------------
  // The agent carries the knowledge-search config the wizard reads, so this
  // one resolver drives all six wizard steps.
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

  // The Sources step lists these to pick knowledge bases from. Their ids must
  // match the keys in the tool config's knowledge_bases map, or every source
  // renders as unknown.
  EditorContexts: (world) => ({
    contexts: {
      items: world.contexts.map(({ id, name, description }) => ({
        id,
        name,
        description,
      })),
    },
  }),

  // Tools, skills and variables are adjacent editor surfaces the tour does not
  // visit. Empty pages render as empty pickers, which is honest — inventing
  // entries would put fictional capabilities on screen.
  EditorTools: () => ({ tools: { items: [] } }),
  EditorToolCategories: () => ({ toolCategories: [] }),
  EditorSkills: () => ({ skillsPagination: { items: [] } }),
  EditorVariables: () => ({ variablesPagination: { items: [] } }),
};

/**
 * A terminating ApolloLink that answers from the current tour step's world.
 *
 * `getWorldForNow` is a thunk, not a value: the tour advances underneath a
 * long-lived Apollo client, and a captured world would freeze the demo at
 * whichever step happened to mount first.
 */
export function createDemoLink(
  getWorldForNow: () => DemoWorld,
  onUnmapped: (operationName: string) => void = (name) =>
    console.warn(`[demo] unmapped GraphQL operation: ${name}`),
): ApolloLink {
  return new ApolloLink((operation) => {
    return new Observable((observer) => {
      const resolver = RESOLVERS[operation.operationName];
      if (!resolver) {
        onUnmapped(operation.operationName);
        observer.next({ data: {} });
        observer.complete();
        return;
      }
      observer.next({
        data: resolver(getWorldForNow(), operation.variables ?? {}),
      });
      observer.complete();
    });
  });
}
