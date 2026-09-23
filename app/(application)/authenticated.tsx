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

import { createDemoLink } from "@/lib/demo/apollo-link";
import { getCurrentPosition } from "@/lib/demo/current-position";
import { getWorld } from "@/lib/demo/fixtures";

import { FeedbackDialog } from "@/components/feedback/feedback-dialog";
import { LiveRecordingProvider } from "@/components/live-recording/live-recording-provider";
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
  /**
   * Whether this is the guided demo — decided by the SERVER and handed down,
   * never re-derived here.
   *
   * isDemoMode() reads process.env.NEXT_PUBLIC_DEMO_MODE, and Next inlines
   * NEXT_PUBLIC_* into the browser bundle at BUILD time while the server
   * reads it at RUNTIME. A deployment that sets the variable at runtime only
   * therefore splits in half: app/(application)/layout.tsx sees demo mode and
   * renders the demo user, the OPEN theme and the tour, while this client
   * component sees `false` baked into the bundle and points Apollo at the
   * real backend. That shipped: the tour narrated perfectly over a knowledge
   * page 500ing with `Authorization: Bearer undefined`.
   *
   * Taking the server's answer as a prop makes the two halves agree by
   * construction. NOTE this fixes THIS component only — the other
   * client-side isDemoMode() callers (lib/api/client.ts, chat/hooks.ts,
   * logo.tsx, brand.tsx, use-autotype.ts, language-provider.tsx …) still read
   * the inlined value, so the build argument remains required.
   */
  demoMode: boolean;
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
}: Omit<AuthenticatedProps, "user" | "demoMode"> & { user: UserWithRole }) => {
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
          <LiveRecordingProvider
            backend={config?.backend ?? ""}
            userId={user.id}
          >
            <SidebarProvider
              defaultOpen={sidebarDefaultOpen}
              className="bg-sidebar overflow-clip"
            >
              <TopBar
                user={shellUser}
                budget={user.budget ?? null}
                onSendFeedback={openFeedback}
              />
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
          </LiveRecordingProvider>
        </MobileTopbarProvider>
      </NavigationErrorBoundary>
    </UserContext.Provider>
  );
};

const Authenticated = ({
  children,
  user,
  sidebarDefaultOpen,
  demoMode,
}: AuthenticatedProps) => {
  const configContext = React.useContext(ConfigContext);

  const uri = configContext?.backend
    ? configContext?.backend + "/graphql"
    : "http://localhost:9001/graphql";

  // Memoized so the client (and its cache) is built once per backend uri
  // instead of on every render. errorPolicy "all" surfaces GraphQL errors to
  // callers via the `error` result field alongside any partial data.
  //
  // `demoMode` belongs in the deps even though it is a server-rendered prop
  // that never changes within a session: without it React Compiler refuses to
  // optimize this component at all ("inferred dependency was demoMode, but
  // the source dependencies were [uri]"), which is a lint error and a real
  // loss of memoization across the whole subtree.
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

    // `demoMode`, not isDemoMode(): see the prop's doc comment. Re-deriving
    // it here is what sent demo traffic to the real backend in production.
    const terminating = demoMode
      ? createDemoLink(() => getWorld(getCurrentPosition()))
      : new HttpLink({ uri: uri });
    const link = ApolloLink.from([basic, authLink, terminating]);

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
  }, [uri, demoMode]);

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
