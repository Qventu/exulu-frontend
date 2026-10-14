import { ApolloLink, Observable } from "@apollo/client/core";
import { demoDateOffsetMs, shiftDemoDates } from "./date-shift";
import { resolverFor } from "./resolvers";
import type { DemoWorld } from "./types";

/**
 * A terminating ApolloLink that answers from the current tour step's world.
 *
 * The resolver table lives in ./resolvers so the server-side fetcher can share
 * it — detail routes render on the server, index routes on the client, and both
 * must see the same fixtures.
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
      const resolver = resolverFor(operation.operationName);
      if (!resolver) {
        onUnmapped(operation.operationName);
        observer.next({ data: {} });
        observer.complete();
        return;
      }
      observer.next({
        // Every timestamp the fixtures carry is shifted to "now minus the
        // same distance", so relative dates stay recent — see date-shift.ts.
        data: shiftDemoDates(resolver(getWorldForNow(), operation.variables ?? {}), demoDateOffsetMs()),
      });
      observer.complete();
    });
  });
}
