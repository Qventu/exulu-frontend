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

import * as React from "react";

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
}

const ChatShellContext = React.createContext<ChatShellContextValue | null>(null);

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
  const [historySheetOpen, setHistorySheetOpen] = React.useState(false);
  const [railCollapsed, setRailCollapsedState] = React.useState(false);

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
    }),
    [agent, historySheetOpen, railCollapsed, setRailCollapsed, toggleHistory],
  );

  return (
    <ChatShellContext.Provider value={value}>
      {/* dvh-bounded full-bleed host (V1 — no 100vh anywhere). At ≥md the app
          shell renders a fixed h-12 top bar (`md:pt-12` on the content column,
          components/shell/top-bar.tsx), so the shell subtracts that 3rem to
          keep the composer on-screen; below md, h-dvh is exact once the
          integrator lands the MobileTopbar suppression on session routes
          (navigation.md §5.3). */}
      <div className="flex h-dvh min-h-0 w-full overflow-hidden md:h-[calc(100dvh-3rem)]">
        {children}
      </div>
    </ChatShellContext.Provider>
  );
}
