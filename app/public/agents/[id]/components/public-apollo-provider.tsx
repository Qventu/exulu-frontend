"use client";

/**
 * PublicApolloProvider — minimal Apollo + next-auth setup for LOGGED-IN
 * external users on public agent pages (public-agents spec §5, Task 11).
 *
 * Mirrors app/(application)/authenticated.tsx's client block VERBATIM (same
 * `basic` + `authLink` links, same InMemoryCache/defaultOptions, same uri
 * construction incl. the localhost fallback) but WITHOUT the app shell — this
 * talks directly to `${backend}/graphql` for session/history reads and the
 * lazy CREATE_AGENT_SESSION mutation. The GraphQL calls carry a bearer token
 * (authLink → getToken); the CHAT stream still routes through the same-origin
 * proxy (chat/route.ts), which attaches Authorization server-side.
 *
 * SessionProvider is required: getToken() → getSession() (next-auth/react)
 * only resolves a token inside a SessionProvider. It also gives signOut() a
 * client session to clear (the Task 10 concern). This provider is mounted ONLY
 * around the authenticated screen — the anonymous path never sees Apollo or a
 * next-auth session (the public layout has neither).
 */

import {
  ApolloClient,
  ApolloLink,
  ApolloProvider,
  HttpLink,
  InMemoryCache,
} from "@apollo/client";
import { setContext } from "@apollo/client/link/context";
import { SessionProvider } from "next-auth/react";
import * as React from "react";

import { ConfigContext } from "@/components/shell/config-context";
import { getToken } from "@/lib/api/client";

export function PublicApolloProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const configContext = React.useContext(ConfigContext);

  // uri construction copied verbatim from authenticated.tsx (incl. fallback).
  const uri = configContext?.backend
    ? configContext?.backend + "/graphql"
    : "http://localhost:9001/graphql";

  // Memoized so the client (and its cache) is built once per backend uri.
  const client = React.useMemo(() => {
    const basic = setContext(() => ({
      headers: {
        Accept: "charset=utf-8",
      },
    }));

    const authLink = setContext(async () => {
      const token = await getToken();
      return {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      };
    });

    const link = ApolloLink.from([basic, authLink, new HttpLink({ uri: uri })]);

    return new ApolloClient({
      uri: uri,
      cache: new InMemoryCache({
        addTypename: false,
      }),
      link: link,
      defaultOptions: {
        watchQuery: {
          fetchPolicy: "no-cache",
          errorPolicy: "all",
        },
        query: {
          fetchPolicy: "no-cache",
          errorPolicy: "all",
        },
      },
    });
  }, [uri]);

  return (
    <SessionProvider>
      <ApolloProvider client={client}>{children}</ApolloProvider>
    </SessionProvider>
  );
}
