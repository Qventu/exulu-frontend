import { ApolloLink, execute, type Observable } from "@apollo/client/core";
import { describe, expect, it } from "vitest";

import {
  GET_AGENT_EDITOR,
  GET_CONTEXTS_EDITOR,
} from "@/app/(application)/agents/edit/[id]/queries";
import {
  GET_CONTEXTS,
  GET_CONTEXT_ICONS,
  GET_USER_CONTEXT_ITEM_FAVOURITES,
} from "@/app/(application)/data/queries";
import { ROUTINE_RUNS_ATTENTION_COUNT } from "@/lib/routine-runs/queries";
import {
  GET_EVAL_RUNS,
  GET_EVAL_SETS,
  GET_TEST_CASES,
} from "@/queries/queries";
import { DEMO_AGENT_ID } from "./fixtures";
import { createDemoLink } from "./apollo-link";
import { getWorld } from "./fixtures";

/**
 * Coverage tests: assert the demo link answers the operations the REAL product
 * pages issue, using the product's own query documents as the source of truth.
 *
 * These exist because the first cut of RESOLVERS was written from guessed
 * operation names (`contexts`, `agents`, ...) before any page was checked
 * against. Every one was wrong, and nothing caught it: unmapped operations
 * return `{data:{}}` by design, so the pages rendered empty rather than broken.
 *
 * Importing the real gql documents means a renamed or reshaped product query
 * fails HERE, at build or test time, instead of silently emptying a demo
 * chapter that nobody notices until a prospect is looking at it.
 */

const world = () => getWorld({ chapter: "ingestion", step: 0 });

function run(document: Parameters<typeof execute>[1]["query"], variables = {}) {
  const link: ApolloLink = createDemoLink(world, () => {
    throw new Error(
      "operation reached the unmapped fallback — add a resolver for it",
    );
  });
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    const obs = execute(link, { query: document, variables }) as Observable<{
      data: Record<string, unknown>;
    }>;
    obs.subscribe({ next: (r) => resolve(r.data), error: reject });
  });
}

describe("/data page operations", () => {
  it("answers GetContexts with the shape the query asks for", async () => {
    const data = await run(GET_CONTEXTS);
    // The query selects `contexts { items { ... } }` — a flat array here would
    // type-check fine and render nothing.
    const contexts = data.contexts as { items: unknown[] };
    expect(Array.isArray(contexts?.items)).toBe(true);
    expect(contexts.items.length).toBeGreaterThan(0);
  });

  it("returns contexts carrying every field the query selects", async () => {
    const data = await run(GET_CONTEXTS);
    const [first] = (data.contexts as { items: Record<string, unknown>[] })
      .items;
    for (const field of [
      "id",
      "name",
      "description",
      "embedder",
      "slug",
      "active",
      "fields",
      "configuration",
      "processor",
      "sources",
    ]) {
      expect(first, `missing selected field: ${field}`).toHaveProperty(field);
    }
  });

  it("answers GetContextIcons under its paginated wrapper", async () => {
    const data = await run(GET_CONTEXT_ICONS, { config_key: "context_icons" });
    const page = data.platform_configurationsPagination as { items: unknown[] };
    expect(Array.isArray(page?.items)).toBe(true);
  });

  it("answers GetUserContextItemFavourites for the demo user", async () => {
    const data = await run(GET_USER_CONTEXT_ITEM_FAVOURITES, { id: "0" });
    const user = data.userById as Record<string, unknown>;
    expect(user).toHaveProperty("favourite_items");
    expect(user).toHaveProperty("recently_viewed_items");
  });
});

describe("/evals operations", () => {
  it("answers all three eval queries under their pagination wrappers", async () => {
    const vars = { page: 1, limit: 50 };
    const sets = await run(GET_EVAL_SETS, vars);
    const cases = await run(GET_TEST_CASES, vars);
    const runs = await run(GET_EVAL_RUNS, vars);

    for (const [label, wrapper] of [
      ["eval_setsPagination", sets.eval_setsPagination],
      ["test_casesPagination", cases.test_casesPagination],
      ["eval_runsPagination", runs.eval_runsPagination],
    ] as const) {
      const w = wrapper as { pageInfo: unknown; items: unknown[] };
      expect(w, `${label} missing`).toBeTruthy();
      // pageInfo is in the selection set; without it the tables cannot render.
      expect(w.pageInfo, `${label}.pageInfo missing`).toBeTruthy();
      expect(w.items.length, `${label} empty`).toBeGreaterThan(0);
    }
  });

  it("filters test cases by eval set rather than showing every suite's cases", async () => {
    const all = await run(GET_TEST_CASES, { page: 1, limit: 50 });
    const filtered = await run(GET_TEST_CASES, {
      page: 1,
      limit: 50,
      filters: [{ eval_set_id: "evalset-regulatory" }],
    });
    const allItems = (all.test_casesPagination as { items: unknown[] }).items;
    const someItems = (filtered.test_casesPagination as { items: { eval_set_id: string }[] }).items;

    expect(someItems.length).toBeLessThan(allItems.length);
    expect(someItems.every((c) => c.eval_set_id === "evalset-regulatory")).toBe(true);
  });

  it("only references agents and knowledge sources the demo world contains", async () => {
    const runsData = await run(GET_EVAL_RUNS, { page: 1, limit: 50 });
    const casesData = await run(GET_TEST_CASES, { page: 1, limit: 50 });
    const contextData = await run(GET_CONTEXTS_EDITOR);

    const knownContexts = new Set(
      (contextData.contexts as { items: { id: string }[] }).items.map((c) => c.id),
    );
    const agentIds = new Set([DEMO_AGENT_ID]);

    for (const r of (runsData.eval_runsPagination as { items: { agent_id: string }[] }).items) {
      expect(agentIds.has(r.agent_id), `run targets unknown agent: ${r.agent_id}`).toBe(true);
    }
    for (const c of (casesData.test_casesPagination as {
      items: { expected_knowledge_sources: string[] }[];
    }).items) {
      for (const src of c.expected_knowledge_sources ?? []) {
        expect(knownContexts.has(src), `case expects unknown context: ${src}`).toBe(true);
      }
    }
  });
});

describe("app shell operations (every page)", () => {
  it("answers the sidebar's routines-attention count", async () => {
    // Unmapped, this warned on every single app route — the first thing the
    // browser console showed once the tour reached the real pages.
    const data = await run(ROUTINE_RUNS_ATTENTION_COUNT);
    expect(data.routineRunsNeedingAttentionCount).toBe(0);
  });
});

describe("/agents/edit/[id] operations", () => {
  it("answers AgentEditorById under agentById", async () => {
    const data = await run(GET_AGENT_EDITOR, { id: "demo-agent-newton" });
    expect(data.agentById).toBeTruthy();
  });

  it("carries a Context Search tool whose config the wizard can parse", async () => {
    const data = await run(GET_AGENT_EDITOR, { id: "demo-agent-newton" });
    const agent = data.agentById as { tools: { name: string; config: unknown[] }[] };
    const tool = agent.tools.find((t) => /context.?search/i.test(t.name));
    expect(tool, "no Context Search tool on the demo agent").toBeTruthy();

    // The wizard reads JSON-typed options as STRINGS off `variable`. A nested
    // object would leave every step silently showing its defaults.
    const byName = Object.fromEntries(
      (tool!.config as { name: string; type: string; variable: string }[]).map(
        (c) => [c.name, c],
      ),
    );
    for (const key of ["knowledge_bases", "routing", "vocabulary", "memory", "tuning"]) {
      expect(byName[key], `missing config option: ${key}`).toBeTruthy();
      expect(byName[key].type).toBe("json");
      expect(() => JSON.parse(byName[key].variable)).not.toThrow();
    }
  });

  it("routes and scopes vocabulary to knowledge bases that actually exist", async () => {
    const data = await run(GET_AGENT_EDITOR, { id: "demo-agent-newton" });
    const agent = data.agentById as { tools: { name: string; config: { name: string; variable: string }[] }[] };
    const cfg = agent.tools[0].config;
    const get = (n: string) => JSON.parse(cfg.find((c) => c.name === n)!.variable);

    const contextData = await run(GET_CONTEXTS_EDITOR);
    const known = new Set(
      (contextData.contexts as { items: { id: string }[] }).items.map((c) => c.id),
    );

    // A routing rule pointing at a context the Sources step never lists renders
    // as an unknown source — the incoherence this test exists to prevent.
    for (const rule of get("routing").rules as { main: string[]; fallback: string[] }[]) {
      for (const id of [...rule.main, ...rule.fallback]) {
        expect(known.has(id), `routing references unknown context: ${id}`).toBe(true);
      }
    }
    for (const id of Object.keys(get("knowledge_bases"))) {
      expect(known.has(id), `knowledge_bases references unknown context: ${id}`).toBe(true);
    }
  });
});
