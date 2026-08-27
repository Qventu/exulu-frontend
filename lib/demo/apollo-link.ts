import { ApolloLink, Observable } from "@apollo/client/core";
import type { DemoWorld } from "./types";

type Resolver = (world: DemoWorld, variables: Record<string, unknown>) => unknown;

/**
 * Operation name -> resolver. Keys must match the operation names in the
 * product's own documents (e.g. `query agents { ... }`), because that is what
 * Apollo puts on operation.operationName.
 */
const RESOLVERS: Record<string, Resolver> = {
  agents: (world) => ({ agents: world.agents }),
  contexts: (world) => ({ contexts: world.contexts }),
  items: (world) => ({ items: world.items }),
  agent_sessions: (world) => ({ agent_sessions: world.sessions }),
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
        data: resolver(getWorldForNow(), operation.variables ?? {}) as Record<
          string,
          unknown
        >,
      });
      observer.complete();
    });
  });
}
