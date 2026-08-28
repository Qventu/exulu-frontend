import { ApolloLink, execute, type Observable } from "@apollo/client/core";
import { describe, expect, it } from "vitest";

import {
  GET_CONTEXTS,
  GET_CONTEXT_ICONS,
  GET_USER_CONTEXT_ITEM_FAVOURITES,
} from "@/app/(application)/data/queries";
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
