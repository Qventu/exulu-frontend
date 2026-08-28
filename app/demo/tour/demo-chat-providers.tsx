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
import { AppSidebar } from "@/components/shell/app-sidebar";
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

  // AppSidebar wants RightsUser & UserMenuUser, which is narrower than
  // UserWithRole: super_admin is optional on the latter and required on the
  // former. Narrowed the same way route-guard.tsx does it rather than cast —
  // `=== true` also means an undefined value can never read as elevated.
  const sidebarUser = React.useMemo(() => {
    const demo = getDemoUser();
    return {
      super_admin: demo.super_admin === true,
      role: demo.role,
      email: demo.email,
    };
  }, []);

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
            The product gets both the provider and the sidebar from AppShell.
            The tour has no app shell, so it composes the same two pieces: the
            provider (ChatHeader's nav trigger calls useSidebar and throws
            without it) and the real AppSidebar, so prospects see the actual
            product navigation rather than a chat surface floating alone.

            AppSidebar reads ConfigContext with a `?? {}` fallback, so its
            absence in demo mode degrades rather than throwing. Feedback is a
            no-op: the dialog belongs to AppShell and posts to a backend the
            demo does not have.
          */}
          <SidebarProvider defaultOpen>
            <AppSidebar user={sidebarUser} onSendFeedback={() => {}} />
            <main className="flex min-h-dvh flex-1 flex-col">{children}</main>
          </SidebarProvider>
        </ChatShellContext.Provider>
      </UserContext.Provider>
    </ApolloProvider>
  );
}
