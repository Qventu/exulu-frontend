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

import { useRouter } from "next/navigation";
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
  children: React.ReactNode;
}

export function PublicChatShell({
  agent,
  basePath,
  activeSessionId,
  children,
}: PublicChatShellProps) {
  const router = useRouter();

  const [historySheetOpen, setHistorySheetOpen] = React.useState(false);
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
    router.push(basePath);
  }, [basePath, router]);

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
      newChatNonce: 0,
      startNewChat,
      beginLazyCreate,
    }),
    [
      agent,
      historySheetOpen,
      railCollapsed,
      setRailCollapsed,
      toggleHistory,
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
          page has no app top bar, so the host is the full dvh (no 3rem inset). */}
      <div className={cn("flex h-dvh min-h-0 w-full overflow-hidden")}>
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
