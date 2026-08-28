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
import { runDemoOperation as run } from "./test-support";

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
 *
 * The evals operations are asserted the same way, but from
 * app/(application)/evals/demo-resolvers.test.ts — they still live in the
 * legacy queries/queries.ts monolith, which lib/** may not import.
 */

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
