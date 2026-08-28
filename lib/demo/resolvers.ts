import { CONTEXT_SEARCH_TOOL, AGENTIC_RETRIEVAL_TOOL } from "./fixtures/agent-editor";
import {
  ALGI_AGENT,
  ALGI_EMAIL_TRIGGER,
  ALGI_ROUTINE,
  ALGI_RUNS,
  ALGI_RUNS_NEEDING_ATTENTION,
} from "./fixtures/chapter-email";
import { MEMORY_SESSION_ID } from "./fixtures/chapter-memory";
import { CONTEXTS } from "./fixtures/contexts";
import {
  EVAL_JOB_RESULTS,
  EVAL_RUNS,
  EVAL_SETS,
  TEST_CASES,
} from "./fixtures/evals";
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

/** The routine as the list and detail screens select it. */
const routineItem = () => ({
  id: ALGI_ROUTINE.id,
  agent: ALGI_ROUTINE.agent,
  queue: ALGI_ROUTINE.queue,
  name: ALGI_ROUTINE.name,
  description: ALGI_ROUTINE.description,
  rights_mode: ALGI_ROUTINE.rights_mode,
  created_by: ALGI_ROUTINE.created_by,
  steps_json: ALGI_ROUTINE.steps_json,
  variables: ALGI_ROUTINE.variables,
  createdAt: ALGI_ROUTINE.createdAt,
  updatedAt: ALGI_ROUTINE.updatedAt,
  // ROUTINES_RBAC_TEAMS_SUPPORTED is false, so `teams` is not selected and is
  // deliberately absent — answering it would be harmless, but omitting a
  // field that IS selected is the error this file keeps making.
  RBAC: { type: "public", users: [], roles: [] },
});

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
  // Real for the whole tour, not just chapter 6: ALGI genuinely has one run
  // sitting in waiting_approval, so the badge shows a 1 and the chapter's
  // "something is waiting for a human" step points at a number the sidebar
  // was already displaying. Derived from the runs rather than written as a
  // literal, so trimming the fixture cannot leave the badge lying.
  RoutineRunsNeedingAttentionCount: () => ({
    routineRunsNeedingAttentionCount: ALGI_RUNS_NEEDING_ATTENTION,
  }),

  // --- /workflows (chapter 6: the ALGI email routine) ---------------------
  // Named "workflow_template" in the API and "Routine" in the UI; both appear
  // below because the operations keep the old name.
  GetWorkflowTemplates: () => ({
    workflow_templatesPagination: {
      pageInfo: page(1),
      items: [routineItem()],
    },
  }),

  GetWorkflowTemplateById: () => ({
    workflow_templateById: {
      id: ALGI_ROUTINE.id,
      name: ALGI_ROUTINE.name,
      agent: ALGI_ROUTINE.agent,
      queue: ALGI_ROUTINE.queue,
      description: ALGI_ROUTINE.description,
      rights_mode: ALGI_ROUTINE.rights_mode,
      steps_json: ALGI_ROUTINE.steps_json,
      variables: ALGI_ROUTINE.variables,
      createdAt: ALGI_ROUTINE.createdAt,
      updatedAt: ALGI_ROUTINE.updatedAt,
      RBAC: { type: "public", users: [], roles: [] },
    },
  }),

  // The Triggers section. `webhook_url` is null and the two has_* booleans are
  // true: the endpoint exists, and the demo says so without publishing it.
  // Its secrets were never read out of the database in the first place.
  GetWorkflowTriggers: () => ({
    workflowTriggers: [
      {
        id: ALGI_EMAIL_TRIGGER.id,
        workflow: ALGI_EMAIL_TRIGGER.workflow,
        type: ALGI_EMAIL_TRIGGER.type,
        enabled: ALGI_EMAIL_TRIGGER.enabled,
        webhook_url: null,
        has_webhook: true,
        has_signing_secret: true,
        last_fired_at: ALGI_EMAIL_TRIGGER.last_fired_at,
        config: ALGI_EMAIL_TRIGGER.config,
        run_as_user: ALGI_EMAIL_TRIGGER.run_as_user,
        createdAt: ALGI_ROUTINE.createdAt,
        updatedAt: ALGI_EMAIL_TRIGGER.last_fired_at,
      },
    ],
  }),

  // The runs console. Honours the filters the UI actually sends, because the
  // chapter points at the needs-attention lens and at the two filtered rows —
  // a resolver that returned all 25 regardless would make both steps narrate
  // something the screen contradicts.
  RoutineRuns: (_world, variables) => {
    let items = ALGI_RUNS;

    const states = variables.states as string[] | undefined;
    if (Array.isArray(states) && states.length) {
      items = items.filter((run) => states.includes(run.state));
    }
    const triggers = variables.triggers as string[] | undefined;
    if (Array.isArray(triggers) && triggers.length) {
      items = items.filter((run) => triggers.includes(run.trigger ?? ""));
    }
    if (variables.needsAttention === true) {
      items = items.filter((run) => run.state === "waiting_approval");
    }
    const search = (variables.search as string | undefined)?.toLowerCase();
    if (search) {
      items = items.filter((run) =>
        `${run.trigger_metadata?.subject ?? ""} ${run.trigger_metadata?.from ?? ""}`
          .toLowerCase()
          .includes(search),
      );
    }

    return {
      routineRuns: {
        total: items.length,
        items: items.map((run) => ({
          // Spread first, then fill the fields the selection asks for that the
          // export did not carry. Tokens and cost are null rather than
          // invented: the runs are real, and nobody measured these.
          job_id: null,
          error: null,
          updatedAt: run.createdAt ?? null,
          inputTokens: null,
          outputTokens: null,
          costUsd: null,
          ...run,
        })),
      },
    };
  },

  // Null, and that is the truth rather than a gap: this routine has no cron.
  // It is triggered by mail arriving, which is the whole point of the chapter
  // — a scheduled routine would be a weaker claim. Returning null is also what
  // the Schedule tab needs to render its "not scheduled" state instead of
  // hanging.
  GetWorkflowSchedule: () => ({ workflowSchedule: null }),

  RoutinesGetAgentById: () => ({
    agentById: { id: ALGI_AGENT.id, name: ALGI_AGENT.name },
  }),

  RoutinesGetAgentsList: (world) => ({
    agentsPagination: {
      items: [...world.agents, ALGI_AGENT].map(({ id, name }) => ({
        id,
        name,
      })),
    },
  }),

  GetAvailableQueues: () => ({
    queues: [{ name: "mail_processing_queue" }, { name: "default" }],
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

  // The set detail page, which is where chapter 5 spends most of its time.
  // Unmapped this returns {}, and the page has no error state for that — it
  // simply renders loading skeletons forever. No console error either, which
  // is why the list screen looked finished and this one was never noticed.
  GetEvalSetById: (_world, variables) => ({
    eval_setById:
      EVAL_SETS.find((set) => set.id === variables.id) ?? EVAL_SETS[0],
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

  // Reachable only because lib/demo/config.ts reports workers as enabled,
  // which is what removes the "not configured" banner from chapter 5's screen
  // — the same flag un-disables these Run buttons. This maps the consequence
  // rather than leaving an error toast behind an enabled button.
  //
  // Zero queued is the literal truth: there are no workers behind the tour.
  // Simulating a run would mean inventing streamed per-case results, which is
  // a much larger fabrication than the static scores already disclosed in
  // fixtures/evals.ts.
  RunEval: () => ({ runEval: { jobs: [], count: 0 } }),

  // One query per run column, filtered by a label prefix. Honouring that
  // filter is not optional: each column averages EVERY row it is handed, so a
  // resolver that ignored the filter would give both runs the same average —
  // the mean of all six results — while the per-case cells still looked right.
  GetJobResults: (_world, variables) => {
    const needle = filterValue(variables, "label");
    const items = needle
      ? EVAL_JOB_RESULTS.filter((row) => row.label.includes(needle))
      : EVAL_JOB_RESULTS;
    return { job_resultsPagination: { pageInfo: page(items.length), items } };
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

  // Save. The editor is a real, editable screen and the tour walks a visitor
  // right through it, so the Save button is one stray click away at all times
  // — and unmapped it produced an error toast on the chapter arguing the
  // product is configurable without an engineer.
  //
  // Echoes the submitted values back over the fixture, which is what the
  // editor needs to leave its dirty state and show a success toast. Nothing
  // persists: the next read comes from the fixture again. That is a fair
  // trade for a scripted tour — the alternative is either a failure the
  // visitor caused by accident, or a mutable demo world that would let one
  // visitor's edits leak into the next one's tour.
  //
  // Every field the mutation SELECTS is listed, not every field it accepts:
  // the selection set is what Apollo writes to the cache, and a missing one
  // is a console error on the same screen. AGENT_FIREWALL_SUPPORTED and
  // AGENT_RBAC_TEAMS_SUPPORTED are false, so `firewall` and `RBAC.teams` are
  // not selected and are deliberately absent here; `image` is, and is not.
  UpdateAgentEditor: (world, variables) => {
    // Typed, not cast to a bare record: the fallbacks below are the agent's
    // real fields, and losing that typing is how a renamed one would slip
    // through as undefined — which reads to Apollo as a missing field.
    const agent = world.agents[0];
    const submitted = (name: string, fallback: unknown) =>
      variables[name] !== undefined ? variables[name] : fallback;

    return {
      agentsUpdateOneById: {
        item: {
          id: agent.id,
          name: submitted("name", agent.name),
          description: submitted("description", agent.description),
          feedback: submitted("feedback", agent.feedback ?? true),
          suggestions_enabled: submitted(
            "suggestions_enabled",
            agent.suggestions_enabled ?? true,
          ),
          sandbox_enabled: submitted(
            "sandbox_enabled",
            agent.sandbox_enabled ?? false,
          ),
          max_tool_steps: submitted("max_tool_steps", 20),
          welcomemessage: submitted("welcomemessage", agent.welcomemessage),
          defaultagent: submitted("defaultagent", agent.defaultagent ?? true),
          instructions: submitted("instructions", agent.instructions),
          memory: submitted("memory", null),
          category: submitted("category", null),
          animation_idle: submitted("animation_idle", null),
          animation_responding: submitted("animation_responding", null),
          rights_mode: submitted("rights_mode", agent.rights_mode ?? "public"),
          active: submitted("active", agent.active ?? true),
          model: submitted("model", null),
          image: submitted("image", null),
          guest_access: submitted("guest_access", false),
          guest_auth_mode: submitted("guest_auth_mode", null),
          // Note the name: the mutation returns guest_HAS_password, never the
          // password itself. Echoing `guest_password` here would answer a
          // field nothing selected and miss the one that is.
          guest_has_password: false,
          guest_cover_image: submitted("guest_cover_image", null),
          RBAC: variables.RBAC ?? {
            type: "agent",
            users: [],
            roles: [],
          },
        },
      },
    };
  },

  // The editor mounts a model selector and an Access section alongside the
  // Knowledge section the chapter is about. All three were unmapped and logged
  // an Apollo error apiece on chapter 3's screen — found in the browser, not by
  // demo-editor.test.ts, which only asserted the operations the agentic
  // retrieval card needs.
  //
  // Empty is accurate rather than expedient: the tour has no LiteLLM
  // deployment behind it, and no roles or teams. An empty ARRAY is a complete
  // answer for the catalogue however many fields the selection lists, since
  // there is no element to be missing one.
  // Two documents select the same `litellmCatalog` root under two operation
  // names — the chat surface's and the agent editor's — and the resolver table
  // is keyed by OPERATION, so mapping one leaves the other unmapped. Mapping
  // GetLiteLLMCatalog alone silenced chat and left the editor still erroring.
  GetLiteLLMCatalog: () => ({ litellmCatalog: [] }),
  GetAgentLiteLLMCatalog: () => ({ litellmCatalog: [] }),
  GetUserRoles: () => ({ rolesPagination: { pageInfo: page(0), items: [] } }),
  GetTeams: () => ({ teamsPagination: { pageInfo: page(0), items: [] } }),

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

  // The item detail page renders an Entities section for every context with an
  // embedder, so this fires on chapter 2's payoff screen. Note the shape: the
  // OPERATION is `EntitiesForItem<ctx>` — context suffixed, not prefixed —
  // which is why the two patterns below do not match it and it reached the
  // unmapped fallback, logging an Apollo error on the screen the chapter ends
  // on. Found by reading the browser console, not by any test.
  //
  // Empty is the truth rather than a convenience: the real deployment has zero
  // rows in this context's entities and chunk_entities tables, so the section
  // renders its empty state exactly as it does in production.
  const entitiesMatch = /^EntitiesForItem([a-z0-9_]+)$/.exec(operationName);
  if (entitiesMatch && isContext(entitiesMatch[1])) {
    const ctx = entitiesMatch[1];
    return () => ({ [`${ctx}_itemsEntitiesForItem`]: [] });
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
