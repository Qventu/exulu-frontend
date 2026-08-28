"use client";

import {
  ApolloClient,
  ApolloLink,
  ApolloProvider,
  InMemoryCache,
} from "@apollo/client";
import { setContext } from "@apollo/client/link/context";
import * as React from "react";

import { UserContext } from "@/app/(application)/authenticated";
import {
  ChatShellContext,
  type ChatShellContextValue,
} from "@/app/(application)/chat/components/chat-shell";
import { SidebarProvider } from "@/components/ui/sidebar";
import { createDemoLink } from "@/lib/demo/apollo-link";
import { getCurrentPosition } from "@/lib/demo/current-position";
import { getWorld } from "@/lib/demo/fixtures";
import { getDemoUser } from "@/lib/demo/user";
import type { Agent } from "@/types/models/agent";

/**
 * Supplies the three contexts SessionScreen needs, so the demo can render the
 * REAL chat surface instead of a lookalike.
 *
 * The product reaches these contexts through `app/(application)`: ChatShell is
 * fed by an async Server Component that calls fetchGraphQLServerSide, which
 * needs a next-auth JWT the demo does not have. Rather than restructure that
 * route tree, the demo builds its own provider stack and hands SessionScreen
 * its props directly — ChatShellContext is exported precisely so "an alternate
 * provider (e.g. the public guest shell) can supply the same context".
 *
 * next-auth's SessionProvider is deliberately absent: nothing in the chat tree
 * calls useSession (only useSessionMutations, which is Apollo).
 */
export function DemoChatProviders({
  agent,
  children,
}: {
  agent: Agent;
  children: React.ReactNode;
}) {
  // Mirrors authenticated.tsx's client, minus auth: same cache config and
  // no-cache/errorPolicy defaults, with the demo link terminating every
  // operation against the current tour step's fixture world.
  const client = React.useMemo(() => {
    const basic = setContext(() => ({
      headers: {
        Accept: "charset=utf-8",
      },
    }));

    return new ApolloClient({
      cache: new InMemoryCache({ addTypename: false }),
      link: ApolloLink.from([
        basic,
        createDemoLink(() => getWorld(getCurrentPosition())),
      ]),
      defaultOptions: {
        watchQuery: { fetchPolicy: "no-cache", errorPolicy: "all" },
        query: { fetchPolicy: "no-cache", errorPolicy: "all" },
      },
    });
  }, []);

  // useChatSession destructures `user` off this context with no null guard, so
  // the default null value would throw before the surface ever rendered.
  const userValue = React.useMemo(() => ({ user: getDemoUser() }), []);

  // The history rail and new-chat plumbing are inert in a scripted tour: the
  // visitor cannot switch sessions, so the setters are stable no-ops rather
  // than state. beginLazyCreate must still return its end callback — the
  // hooks call it in a finally block.
  const shell = React.useMemo<ChatShellContextValue>(
    () => ({
      agent,
      historySheetOpen: false,
      setHistorySheetOpen: () => {},
      railCollapsed: true,
      setRailCollapsed: () => {},
      toggleHistory: () => {},
      newChatNonce: 0,
      startNewChat: () => {},
      beginLazyCreate: () => () => {},
    }),
    [agent],
  );

  return (
    <ApolloProvider client={client}>
      <UserContext.Provider value={userValue}>
        <ChatShellContext.Provider value={shell}>
          {/*
            ChatHeader's nav trigger calls useSidebar, which throws outside a
            provider. In the product this comes from AppShell; the tour has no
            app shell, so it supplies its own. Collapsed by default — the tour
            is the navigation here.
          */}
          <SidebarProvider defaultOpen={false}>{children}</SidebarProvider>
        </ChatShellContext.Provider>
      </UserContext.Provider>
    </ApolloProvider>
  );
}
