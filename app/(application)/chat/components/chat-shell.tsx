"use client";

/**
 * ChatShell — the client shell mounted by /chat/[agent]/layout.tsx
 * (work item 2.3, owner: orchestration; design/pages/chat.md "The Quiet
 * Column").
 *
 * - Hosts ChatShellContext: history Sheet open state (<lg), docked-rail
 *   collapsed state (≥lg, persisted under "chat.historyRail.collapsed"),
 *   and toggleHistory() — ChatHeader's single History trigger, which picks
 *   sheet-vs-rail by viewport.
 * - `h-dvh` full-bleed host (kills the legacy `h-[100vh]`, responsive.md V1).
 *   Children render in a flex row: the HistoryRail slot left at ≥lg
 *   (the rail renders itself; its width animation is 200ms ease-in-out and
 *   reduced-motion-safe per chat.md motion #3), page content right.
 * - Exports CHAT_COLUMN — the ONE column width every in-column surface uses
 *   (messages, suggestions, alerts, notices, composer, disclaimer), replacing
 *   the legacy 850/672/850 mix (chat.md U1/U9).
 */

import { usePathname, useSelectedLayoutSegment } from "next/navigation";
import * as React from "react";

import { isChatSessionRoute } from "@/components/shell/mobile-topbar";
import { cn } from "@/lib/utils";
import type { Agent } from "@/types/models/agent";

/** The single conversation-column width (chat.md §3 "One width"). */
export const CHAT_COLUMN = "mx-auto w-full max-w-3xl px-4";

const RAIL_COLLAPSED_KEY = "chat.historyRail.collapsed";
const LG_QUERY = "(min-width: 1024px)";

export interface ChatShellContextValue {
  agent: Agent;
  /** <lg: left Sheet open state (history). */
  historySheetOpen: boolean;
  setHistorySheetOpen: (open: boolean) => void;
  /** ≥lg: docked rail collapsed state, persisted ("chat.historyRail.collapsed"). */
  railCollapsed: boolean;
  setRailCollapsed: (collapsed: boolean) => void;
  /** ChatHeader's History trigger: <lg opens the sheet, ≥lg toggles the rail. */
  toggleHistory: () => void;
  /**
   * New-chat remount signal. The lazy session create (hooks.ts createSession)
   * swaps the URL with a raw history.replaceState, so the App Router tree keeps
   * `[session] = "new"` — a later Link/push to /chat/[agent]/new diffs as
   * "nothing changed" and re-renders nothing. New-chat actions reachable while
   * a SessionScreen may be mounted on that stale tree must call startNewChat()
   * alongside their navigation; SessionScreen keys on the nonce and remounts
   * into the pristine /new state. The bump self-gates to the actual desync
   * (tree reads "new" while the URL shows a session id), so callers on real
   * session routes or the pristine /new screen get a no-op — /new links whose
   * origin can never be desynced (search page, server error states) correctly
   * omit it.
   */
  newChatNonce: number;
  startNewChat: () => void;
  /**
   * hooks.ts createSession marks the lazy-create window (mutation in flight,
   * URL swap not yet landed) so startNewChat can treat "URL still /new but a
   * session is being born" as needing the bump too. Returns an end callback
   * for the finally block. Generation-scoped counter under the hood: a nonce
   * bump orphans every open window (their resolutions are defused by the
   * hooks' aliveRef/epoch guards), so it resets the counter — and an
   * orphaned window's end callback must NOT clear a newer instance's
   * still-open window.
   */
  beginLazyCreate: () => () => void;
}

// Exported so an alternate provider (e.g. the public guest shell) can supply
// the same context to the shared HistoryRail/SessionRow. ChatShell itself is
// unchanged.
export const ChatShellContext =
  React.createContext<ChatShellContextValue | null>(null);

export function useChatShell(): ChatShellContextValue {
  const ctx = React.useContext(ChatShellContext);
  if (!ctx) {
    throw new Error("useChatShell must be used within <ChatShell>");
  }
  return ctx;
}

export interface ChatShellProps {
  agent: Agent;
  children: React.ReactNode;
}

export function ChatShell({ agent, children }: ChatShellProps) {
  const pathname = usePathname();
  // The child segment as the ROUTER TREE sees it ("new", a session id, or
  // "search") — after the lazy-create URL swap this stays "new" while
  // usePathname already shows the real session id. That divergence IS the
  // desync startNewChat exists for.
  const selectedSegment = useSelectedLayoutSegment();
  const [historySheetOpen, setHistorySheetOpen] = React.useState(false);
  const [railCollapsed, setRailCollapsedState] = React.useState(false);
  const [newChatNonce, setNewChatNonce] = React.useState(0);

  const lazyCreateRef = React.useRef({ gen: 0, count: 0 });
  const beginLazyCreate = React.useCallback(() => {
    const gen = lazyCreateRef.current.gen;
    lazyCreateRef.current.count += 1;
    let ended = false;
    return () => {
      if (ended) return;
      ended = true;
      // Skip if a nonce bump reset the window since — decrementing here
      // would clear a NEWER instance's still-open create window and
      // resurrect the swallowed-click bug for it.
      if (lazyCreateRef.current.gen === gen) {
        lazyCreateRef.current.count = Math.max(
          0,
          lazyCreateRef.current.count - 1,
        );
      }
    };
  }, []);

  const startNewChat = React.useCallback(() => {
    // Bump only when the paired navigation cannot restore the pristine /new
    // screen by itself:
    // - desynced: tree reads "new" but the URL already shows a session id
    //   (the lazy-create replaceState landed) — the push is a no-op tree diff.
    // - lazy create in flight: the swap hasn't landed yet, so URL and tree
    //   BOTH still read /new — the push no-ops AND the resolving create would
    //   drop the user into the abandoned session; the bump remounts and the
    //   aliveRef/epoch guards in hooks.ts defuse the orphaned continuation.
    // On real session routes the push is a genuine navigation (remounting
    // here would roll the conversation back to its load-time snapshot), and
    // on a truly pristine /new a bump would wipe the composer draft.
    // Matched with /\/new\/?$/ (not endsWith) so a future trailingSlash
    // config can't flip the pristine branch into a draft-wiping bump.
    // KNOWN HAZARD if `cacheComponents` is ever enabled: the router bfcache
    // (3 entries) can re-activate a desynced SessionScreen from a previous
    // visit whose pathname already ends in /new — this gate would then
    // suppress a needed bump. Re-audit before adopting that flag.
    const onNewUrl = /\/new\/?$/.test(pathname ?? "");
    if (
      selectedSegment === "new" &&
      (!onNewUrl || lazyCreateRef.current.count > 0)
    ) {
      // The remount orphans every open create window (aliveRef/epoch guards
      // defuse their resolutions), so their pending state is void — reset it,
      // or a hung mutation would leave the flag stuck and turn pristine-/new
      // clicks into draft-wiping bumps forever.
      lazyCreateRef.current = { gen: lazyCreateRef.current.gen + 1, count: 0 };
      setNewChatNonce((nonce) => nonce + 1);
    }
  }, [selectedSegment, pathname]);

  // Read the persisted rail state after mount (SSR-safe: server renders the
  // expanded default, the stored preference applies on hydration).
  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem(RAIL_COLLAPSED_KEY);
      if (stored === "true") setRailCollapsedState(true);
    } catch {
      // localStorage unavailable — expanded default is fine.
    }
  }, []);

  const setRailCollapsed = React.useCallback((collapsed: boolean) => {
    setRailCollapsedState(collapsed);
    try {
      window.localStorage.setItem(RAIL_COLLAPSED_KEY, String(collapsed));
    } catch {
      // Persistence is best-effort.
    }
  }, []);

  // <lg opens the sheet, ≥lg toggles the rail — decided at invocation time so
  // a window resize between clicks always targets the visible surface.
  const toggleHistory = React.useCallback(() => {
    const isDesktop =
      typeof window !== "undefined" && window.matchMedia(LG_QUERY).matches;
    if (isDesktop) {
      setRailCollapsedState((prev) => {
        const next = !prev;
        try {
          window.localStorage.setItem(RAIL_COLLAPSED_KEY, String(next));
        } catch {
          // Persistence is best-effort.
        }
        return next;
      });
    } else {
      setHistorySheetOpen((prev) => !prev);
    }
  }, []);

  const value = React.useMemo<ChatShellContextValue>(
    () => ({
      agent,
      historySheetOpen,
      setHistorySheetOpen,
      railCollapsed,
      setRailCollapsed,
      toggleHistory,
      newChatNonce,
      startNewChat,
      beginLazyCreate,
    }),
    [
      agent,
      historySheetOpen,
      railCollapsed,
      setRailCollapsed,
      toggleHistory,
      newChatNonce,
      startNewChat,
      beginLazyCreate,
    ],
  );

  return (
    <ChatShellContext.Provider value={value}>
      {/* dvh-bounded full-bleed host (V1 — no 100vh anywhere). At ≥md the app
          shell renders a fixed h-12 top bar (`md:pt-12` on the content column,
          components/shell/top-bar.tsx), so the shell subtracts that 3rem to
          keep the composer on-screen. Below md the shell MobileTopbar is
          suppressed on SESSION routes only (navigation.md §5.3) — there
          h-dvh is exact; on the remaining /chat/[agent] routes (search) the
          bar stays visible (h-12 + safe-area top), so its height is
          subtracted too or the page bottom would sit one bar-height below
          the fold (double scroll at 390px). */}
      <div
        className={cn(
          "flex min-h-0 w-full overflow-hidden md:h-[calc(100dvh-3rem)]",
          isChatSessionRoute(pathname)
            ? "h-dvh"
            : "h-[calc(100dvh-3rem-env(safe-area-inset-top))]",
        )}
      >
        {children}
      </div>
    </ChatShellContext.Provider>
  );
}
