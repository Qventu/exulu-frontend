"use client";

/**
 * PublicChatShell — an alternate ChatShellContext provider for the guest
 * (authenticated) chat, so the shared internal HistoryRail/SessionRow render
 * with public /public/agents URLs instead of the internal /chat routes.
 *
 * The internal ChatShell couples its context to the App Router's lazy-create
 * remount machinery (newChatNonce / beginLazyCreate / the selectedSegment
 * desync gate). Public guest chat does NOT use that machinery — session
 * switching and New chat are full server navigations (the rail hrefs point at
 * /public/agents/${id}?session=${sid}), and the public session manager owns
 * lazy server-session creation. So those two members are satisfied with inert
 * values (nonce fixed at 0, beginLazyCreate returns a no-op end callback):
 * nothing in the public tree keys on the nonce or reads the lazy-create window.
 *
 * Members satisfied from real state: historySheetOpen/setHistorySheetOpen (the
 * mobile history Sheet), railCollapsed/setRailCollapsed (persisted under a NEW
 * key so it doesn't collide with the internal rail preference), toggleHistory
 * (viewport-aware, mirrors ChatShell), and startNewChat (push the bare base URL
 * = a fresh chat, and close the sheet).
 */

import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

import {
  ChatShellContext,
  type ChatShellContextValue,
} from "@/app/(application)/chat/components/chat-shell";
import { HistoryRail } from "@/app/(application)/chat/components/history-rail";
import type { HistoryRailPaths } from "@/app/(application)/chat/components/history-rail";
import { cn } from "@/lib/utils";
import type { Agent } from "@/types/models/agent";

const RAIL_COLLAPSED_KEY = "publicChat.historyRail.collapsed";
const LG_QUERY = "(min-width: 1024px)";

export interface PublicChatShellProps {
  agent: Agent;
  /** Base URL for this public agent, e.g. /public/agents/${id}. */
  basePath: string;
  /** The rail's active-session highlight (URL-param driven, not pathname). */
  activeSessionId?: string;
  /**
   * Clear the caller's session state when a new chat starts. The nonce below
   * only remounts the conversation BELOW this shell; the session manager lives
   * above it, so without this the next message would be posted into the
   * session the user just navigated away from.
   */
  onNewChat?: () => void;
  children: React.ReactNode;
}

export function PublicChatShell({
  agent,
  basePath,
  activeSessionId,
  onNewChat,
  children,
}: PublicChatShellProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [historySheetOpen, setHistorySheetOpen] = React.useState(false);
  // Mirrors ChatShell: bumped by startNewChat so the conversation subtree
  // remounts. The page's `key={sessionParam}` cannot cover every case on its
  // own — after a lazy session create the URL is swapped with
  // history.replaceState, which Next's router never sees, so a later
  // router.push(basePath) is a no-op navigation and the server-side key stays
  // "new" on both sides of the click.
  const [newChatNonce, setNewChatNonce] = React.useState(0);
  const [railCollapsed, setRailCollapsedState] = React.useState(false);

  // Read the persisted rail state after mount (SSR-safe, mirrors ChatShell).
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

  // <lg opens the sheet, ≥lg toggles the rail — decided at invocation time.
  // Functional update (mirror of ChatShell.toggleHistory): never captures a
  // stale railCollapsed, so rapid double-clicks toggle twice, not net-zero.
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

  // A bare base URL is a fresh chat; also close the mobile sheet.
  const startNewChat = React.useCallback(() => {
    setHistorySheetOpen(false);
    onNewChat?.();
    // Prefer letting the navigation drive the remount: the server then sends
    // the empty conversation along with it, so nothing has to guess.
    //
    // The nonce is the fallback for the one case a navigation cannot handle —
    // after a lazy session create the URL was swapped with
    // history.replaceState, which Next never saw, so router.push(basePath) is
    // a no-op and no new props ever arrive. useSearchParams reflects NEXT's
    // view, not the address bar, which is exactly the distinction needed here.
    //
    // Bumping it unconditionally is what made "New chat" need two clicks: the
    // nonce remounted the conversation immediately, while initialMessages
    // still held the session being left.
    if (searchParams?.get("session")) {
      router.push(basePath);
    } else {
      setNewChatNonce((n) => n + 1);
    }
  }, [basePath, onNewChat, router, searchParams]);

  // Inert lazy-create window — public chat never keys on it (see file header).
  const beginLazyCreate = React.useCallback(() => () => {}, []);

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

  const publicPaths: HistoryRailPaths = React.useMemo(
    () => ({
      session: (sid: string) =>
        `${basePath}?session=${encodeURIComponent(sid)}`,
      newChat: basePath,
      search: null,
    }),
    [basePath],
  );

  return (
    <ChatShellContext.Provider value={value}>
      {/* Mirror ChatShell's dvh-bounded full-bleed host: the rail docks left at
          ≥lg (it renders itself), the chat column fills the rest. The public
          page has no app top bar, so the host is the full dvh (no 3rem inset).
          h-dvh-keyboard, not h-dvh: iOS keeps 100dvh at full screen height
          while the keyboard is open, which left the composer behind it. The
          utility subtracts the measured keyboard strip and is plain h-dvh
          everywhere that has no keyboard open (globals.css). */}
      <div className={cn("flex h-dvh-keyboard min-h-0 w-full overflow-hidden")}>
        <HistoryRail
          agent={agent}
          paths={publicPaths}
          activeSessionId={activeSessionId}
          hideAgentSwitcher
        />
        {children}
      </div>
    </ChatShellContext.Provider>
  );
}
