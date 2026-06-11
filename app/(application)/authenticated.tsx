"use client";

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

import { FeedbackDialog } from "@/components/feedback/feedback-dialog";
import {
  AppSidebar,
  type AppSidebarUser,
} from "@/components/shell/app-sidebar";
import { CommandPalette } from "@/components/shell/command-palette";
import { ConfigContext } from "@/components/shell/config-context";
import { NavigationErrorBoundary } from "@/components/shell/error-boundary";
import {
  MobileTopbar,
  MobileTopbarProvider,
} from "@/components/shell/mobile-topbar";
import { TopBar } from "@/components/shell/top-bar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { getToken } from "@/lib/api/client";
import { type UserWithRole } from "@/types/models/user";

interface AuthenticatedProps {
  children: React.ReactNode;
  user: UserWithRole;
  sidebarDefaultOpen: boolean;
}

export const UserContext = React.createContext<any>(null);

/**
 * AppShell — the composed shell (navigation.md §7: replaces MainNavProvider).
 *
 * The 2026-06-11 chrome decision (navigation.md §3): top bar + sidebar share
 * the `--sidebar` background as one chrome "L"; the page content is an inset
 * card with a rounded top-left corner flowing out of the chrome.
 *
 * SidebarProvider (state + ⌘B + tooltips, `bg-sidebar` = the chrome tone)
 * wraps:
 *  - TopBar — fixed h-12 desktop chrome (brand + collapse · feedback ·
 *    search ⌘K · avatar),
 *  - AppSidebar — "The Spine", pure nav (desktop rail + mobile Sheet
 *    drawer), padded below the fixed bar,
 *  - the content column: MobileTopbar (<md; self-suppresses on chat
 *    sessions) above the inset page card — the scroll container (a div —
 *    the single <main> landmark lives in app/(application)/layout.tsx,
 *    a11y fix M11),
 *  - CommandPalette (global ⌘K, fed from the same nav-config),
 *  - ONE FeedbackDialog instance, shared by the TopBar button, the drawer's
 *    "Send feedback" item and the palette's entry. It mounts here — outside
 *    the mobile Sheet — so closing the drawer cannot unmount an open dialog.
 */
const AppShell = ({
  children,
  user,
  sidebarDefaultOpen,
}: Omit<AuthenticatedProps, "user"> & { user: UserWithRole }) => {
  const config = React.useContext(ConfigContext);
  const [feedbackOpen, setFeedbackOpen] = React.useState(false);
  const openFeedback = React.useCallback(() => setFeedbackOpen(true), []);

  // The RightsUser slice the shell consumes (nav-config/palette gating) plus
  // the email for the user-menu row.
  const shellUser = React.useMemo<AppSidebarUser>(
    () => ({
      super_admin: user.super_admin === true,
      role: user.role,
      email: user.email,
    }),
    [user],
  );

  return (
    <UserContext.Provider value={{ user }}>
      <NavigationErrorBoundary>
        <MobileTopbarProvider>
          <SidebarProvider
            defaultOpen={sidebarDefaultOpen}
            className="bg-sidebar overflow-clip"
          >
            <TopBar user={shellUser} onSendFeedback={openFeedback} />
            <AppSidebar user={shellUser} onSendFeedback={openFeedback} />
            <div className="flex min-w-0 flex-1 flex-col md:pt-12">
              <MobileTopbar user={shellUser} />
              <div className="min-w-0 flex-1 overflow-auto bg-background md:rounded-tl-2xl md:border-l md:border-t md:border-sidebar-border">
                {children}
              </div>
            </div>
            <CommandPalette
              user={shellUser}
              config={config ?? {}}
              onSendFeedback={openFeedback}
            />
            <FeedbackDialog
              open={feedbackOpen}
              onOpenChange={setFeedbackOpen}
            />
          </SidebarProvider>
        </MobileTopbarProvider>
      </NavigationErrorBoundary>
    </UserContext.Provider>
  );
};

const Authenticated = ({
  children,
  user,
  sidebarDefaultOpen,
}: AuthenticatedProps) => {
  const configContext = React.useContext(ConfigContext);

  const uri = configContext?.backend
    ? configContext?.backend + "/graphql"
    : "http://localhost:9001/graphql";

  // Memoized so the client (and its cache) is built once per backend uri
  // instead of on every render. errorPolicy "all" surfaces GraphQL errors to
  // callers via the `error` result field alongside any partial data.
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
    <ApolloProvider client={client}>
      <SessionProvider>
        <AppShell sidebarDefaultOpen={sidebarDefaultOpen} user={user}>
          {children}
        </AppShell>
      </SessionProvider>
    </ApolloProvider>
  );
};

export default Authenticated;
