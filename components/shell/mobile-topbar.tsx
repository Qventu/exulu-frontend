"use client";

/**
 * MobileTopbar — the shell's 48px top bar below `md` (design/navigation.md
 * §5.1): `[AppNavTrigger] [current page label] [spacer] [page action slot]`.
 *
 * This is the guaranteed drawer trigger the app previously lacked on phones
 * (shell audit H3). It is shell chrome: integration mounts <MobileTopbar />
 * exactly once in app/(application)/layout.tsx, above the page content and
 * inside SidebarProvider (AppNavTrigger needs the sidebar context).
 *
 * Chat-session suppression (navigation.md §5.3) is handled INSIDE the
 * component via a pathname check: on /chat/[agent]/[session|new] the bar
 * returns null and the ChatHeader is the only bar (it mounts AppNavTrigger
 * itself). /chat, /chat/[agent], and /chat/[agent]/search keep the bar.
 * TEMPORARILY DISABLED until the chat header rework lands — see the
 * TODO(redesign Phase 2.3) at the suppression site below.
 *
 * Page-action slot API (one primary action per page, philosophy §5):
 *
 *   1. Integration wraps the layout body in <MobileTopbarProvider> (it must
 *      enclose BOTH <MobileTopbar /> and {children}).
 *   2. A page (or its client header) renders, anywhere in its tree:
 *        <MobileTopbarAction>
 *          <Button size="sm">…</Button>
 *        </MobileTopbarAction>
 *      The children are teleported into the bar's right-hand slot and removed
 *      on unmount. MobileTopbarAction renders nothing in place.
 *   3. Without the provider (or without a registered action) the bar simply
 *      renders no action — both pieces degrade gracefully.
 *
 * Safe area: the bar pads itself by env(safe-area-inset-top); the root
 * viewport meta must declare `viewport-fit=cover` for the env() var to be
 * non-zero on notched devices (integration owns layout.tsx).
 *
 * No motion of its own — the drawer slide/scrim animation lives in the
 * sidebar Sheet (navigation.md §6 #3).
 */

import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import * as React from "react";

import { AppNavTrigger } from "@/components/shell/app-nav-trigger";
import { activeEntryFor } from "@/components/shell/nav-config";
import { UserMenu, type UserMenuUser } from "@/components/shell/user-menu";
import { cn } from "@/lib/utils";

/* ----------------------------- action slot ------------------------------ */

interface MobileTopbarActionApi {
  set: (owner: string, node: React.ReactNode) => void;
  clear: (owner: string) => void;
}

/**
 * Value and api live in separate contexts so registering an action re-renders
 * only the bar — never the page that registered it.
 */
const ActionValueContext = React.createContext<React.ReactNode>(null);
const ActionApiContext = React.createContext<MobileTopbarActionApi | null>(
  null,
);

/**
 * Hosts the action-slot state. Mount once in the application layout, wrapping
 * both <MobileTopbar /> and the routed page content.
 */
function MobileTopbarProvider({ children }: { children: React.ReactNode }) {
  const [action, setAction] = React.useState<{
    owner: string;
    node: React.ReactNode;
  } | null>(null);

  const api = React.useMemo<MobileTopbarActionApi>(
    () => ({
      set: (owner, node) => setAction({ owner, node }),
      // Owner check: during route transitions the outgoing page's cleanup
      // must not wipe an action the incoming page already registered.
      clear: (owner) =>
        setAction((current) => (current?.owner === owner ? null : current)),
    }),
    [],
  );

  return (
    <ActionApiContext.Provider value={api}>
      <ActionValueContext.Provider value={action?.node ?? null}>
        {children}
      </ActionValueContext.Provider>
    </ActionApiContext.Provider>
  );
}

/**
 * Declarative registration of the page's mobile-bar action. Renders nothing
 * where it is mounted; its children appear in the bar's right-hand slot while
 * it is mounted. No-ops when MobileTopbarProvider is absent.
 */
function MobileTopbarAction({ children }: { children: React.ReactNode }) {
  const owner = React.useId();
  const api = React.useContext(ActionApiContext);

  React.useEffect(() => {
    api?.set(owner, children);
  }, [api, owner, children]);

  React.useEffect(() => {
    if (!api) return;
    return () => api.clear(owner);
  }, [api, owner]);

  return null;
}

/* ------------------------------- the bar -------------------------------- */

/**
 * Chat sessions are full-screen on mobile (navigation.md §5.3): the shell bar
 * is suppressed on /chat/[agent]/[session] and /chat/[agent]/new, while
 * /chat, /chat/[agent], and /chat/[agent]/search keep it.
 */
export function isChatSessionRoute(pathname: string): boolean {
  const segments = pathname.split("/").filter(Boolean);
  return (
    segments[0] === "chat" && segments.length >= 3 && segments[2] !== "search"
  );
}

export interface MobileTopbarProps
  extends React.HTMLAttributes<HTMLElement> {
  /** The signed-in account — feeds the top-right avatar menu (§3 chrome). */
  user?: UserMenuUser | null;
}

/**
 * The bar itself: `h-12 px-3 border-b`, rendered below `md` only. The current
 * page label resolves from nav-config's activeEntryFor(pathname) → i18n label
 * (nav label = page H1 = palette entry, navigation.md §1.1 #4). The avatar
 * menu anchors the right edge (2026-06-11 chrome decision: profile top-right
 * on every viewport).
 */
const MobileTopbar = React.forwardRef<HTMLElement, MobileTopbarProps>(
  ({ className, user, ...props }, ref) => {
    const pathname = usePathname();
    const t = useTranslations();
    const action = React.useContext(ActionValueContext);

    // TODO(redesign Phase 2.3 — chat): restore the suppression
    //   `if (isChatSessionRoute(pathname)) return null;`
    // once ChatHeader mounts AppNavTrigger as its leftmost control. Until
    // then the agreed fallback applies (navigation.md §7 "Risks", plan §3 1A):
    // the shell bar renders above chat's own chrome — ugly but navigable.
    // Suppressing it today would leave the nav drawer unreachable on
    // /chat/[agent]/[session] below `md` (exit criterion: drawer reachable
    // on every route at 390px).

    const entry = activeEntryFor(pathname);

    return (
      <header
        ref={ref}
        className={cn(
          "border-b bg-background pt-[env(safe-area-inset-top)] md:hidden",
          className,
        )}
        {...props}
      >
        <div className="flex h-12 items-center gap-2 px-3">
          <AppNavTrigger className="-ml-2" />
          <span className="min-w-0 flex-1 truncate text-sm font-medium">
            {entry ? t(entry.i18nKey) : null}
          </span>
          {action ? (
            <div className="flex shrink-0 items-center gap-1">{action}</div>
          ) : null}
          <UserMenu user={user} className="-mr-1" />
        </div>
      </header>
    );
  },
);
MobileTopbar.displayName = "MobileTopbar";

export { MobileTopbar, MobileTopbarProvider, MobileTopbarAction };
