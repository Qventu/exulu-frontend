import {
  ApolloClient,
  ApolloLink,
  InMemoryCache,
  execute,
  type Observable,
} from "@apollo/client/core";

import { createDemoLink } from "./apollo-link";
import { getWorld } from "./fixtures";
import type { TourPosition } from "./tour";

/**
 * Runs a real product gql document through the demo link and resolves its data.
 *
 * Shared rather than duplicated because the coverage tests live in two places:
 * most sit beside the link in lib/demo, but operations still owned by the
 * legacy queries/queries.ts monolith have to be asserted from inside the
 * feature that owns them (lib/ is barred from importing the monolith), so
 * app/(application)/evals carries its own.
 *
 * The unmapped fallback throws here. In production it warns and returns
 * `{data:{}}` so a missing resolver degrades to an empty page; in a test that
 * silence is the failure mode we are trying to catch.
 */
export function runDemoOperation(
  document: Parameters<typeof execute>[1]["query"],
  variables: Record<string, unknown> = {},
  at: TourPosition = { chapter: "ingestion", step: 0 },
) {
  const link = strictDemoLink(at);
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    const obs = execute(link, { query: document, variables }) as Observable<{
      data: Record<string, unknown>;
    }>;
    obs.subscribe({ next: (r) => resolve(r.data), error: reject });
  });
}

/**
 * The same thing, but through a real ApolloClient with a normalising cache.
 *
 * Worth the extra ceremony for anything the product renders from `useQuery`.
 * `execute()` hands back whatever the resolver returned, so a fixture missing a
 * field the document selects passes. A cache does not: it writes the result,
 * diffs it back against the selection set, and an incomplete diff yields
 * `data: undefined` — a table that renders its empty state with no error
 * anywhere. Every `Item` field is optional in types/models/item.ts, so
 * TypeScript will not catch the omission either.
 */
export async function runDemoQueryThroughCache(
  document: Parameters<typeof execute>[1]["query"],
  variables: Record<string, unknown> = {},
  at: TourPosition = { chapter: "ingestion", step: 0 },
) {
  const client = new ApolloClient({
    link: strictDemoLink(at),
    cache: new InMemoryCache(),
  });
  const result = await client.query({
    query: document,
    variables,
    fetchPolicy: "network-only",
  });
  return result.data as Record<string, unknown>;
}

/** Turns the production warn-and-continue fallback into a test failure. */
function strictDemoLink(at: TourPosition): ApolloLink {
  return createDemoLink(
    () => getWorld(at),
    (name) => {
      throw new Error(
        `operation reached the unmapped fallback — add a resolver for ${name}`,
      );
    },
  );
}
