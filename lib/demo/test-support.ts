import { ApolloLink, execute, type Observable } from "@apollo/client/core";

import { createDemoLink } from "./apollo-link";
import { getWorld } from "./fixtures";

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
) {
  const world = () => getWorld({ chapter: "ingestion", step: 0 });
  const link: ApolloLink = createDemoLink(world, (name) => {
    throw new Error(
      `operation reached the unmapped fallback — add a resolver for ${name}`,
    );
  });
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    const obs = execute(link, { query: document, variables }) as Observable<{
      data: Record<string, unknown>;
    }>;
    obs.subscribe({ next: (r) => resolve(r.data), error: reject });
  });
}
