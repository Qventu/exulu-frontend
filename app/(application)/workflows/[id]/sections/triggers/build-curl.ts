import type { Routine } from "../../../types";

/**
 * Builds a copyable cURL command that triggers a routine via the GraphQL
 * `runWorkflow` mutation. The routine id and its variable names are prefilled;
 * the caller supplies a bearer token via the `$EXULU_TOKEN` shell variable.
 * `backend` is the API base URL (e.g. `ConfigContext.backend`); an empty base
 * still renders a valid command shape ending in `/graphql`.
 */
export function buildRunWorkflowCurl(routine: Routine, backend: string): string {
  const varsObject = Object.fromEntries(
    (routine.variables ?? []).map((name) => [name, "..."]),
  );
  const body = JSON.stringify({
    query:
      'mutation($variables: JSON) { runWorkflow(id: "' +
      routine.id +
      '", variables: $variables) { job } }',
    variables: { variables: varsObject },
  });
  return [
    `curl -X POST ${backend}/graphql \\`,
    `  -H "Authorization: Bearer $EXULU_TOKEN" \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -d '${body}'`,
  ].join("\n");
}
