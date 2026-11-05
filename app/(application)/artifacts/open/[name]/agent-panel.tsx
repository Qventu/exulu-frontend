"use client";

/**
 * AgentPanel — the real chat surface, docked beside the artifact.
 *
 * This is a HOST, not a second chat: it supplies an alternate
 * `ChatShellContext` and mounts the shared `SessionScreen` (which instantiates
 * the one `useChatSession` controller) and the shared `HistoryRail` inside the
 * `SidePanel` primitive. `app/public/agents/[id]/components/public-chat-shell.tsx`
 * is the same move for the guest route; what that file did NOT do — and this
 * one must not either — is fork the controller the way its
 * `use-public-chat-session.ts` sibling did (plan non-goal: "no new chat
 * implementation").
 *
 * Three host-specific decisions:
 *
 * - **URLs stay on the artifact.** The rail's rows and New chat point at
 *   `/artifacts/open/<name>?session=<sid>` through `HistoryRailPaths`, and
 *   `sessionPath` (Task 6) sends the lazy session create's `replaceState` to
 *   the same place. Without the latter the first send would rewrite the
 *   artifact page's URL to `/chat/<agent>/<session>` under the user's feet.
 * - **The history rail starts collapsed.** The panel is ~400px; a docked 256px
 *   rail would leave no conversation column. `ChatHeader`'s History trigger
 *   (`toggleHistory`) brings it in, exactly as it does in the full page.
 * - **Collapse is not close.** Collapsing hides the docked panel (its subtree
 *   stays mounted, so the conversation and its stream survive) and leaves a
 *   thin edge in its place, giving the artifact its width back without ending
 *   the session. Closing unmounts the panel; see `open`.
 *
 * Below `lg` `SidePanel` is a Sheet, so the panel overlays the artifact
 * instead of squeezing it and this component occupies no width in the row —
 * which is exactly what `onWidthChange` then reports (0), because it measures
 * its own root rather than asking the panel how wide it thinks it is.
 */

import type { UIMessage } from "ai";
import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

/* eslint-disable no-restricted-imports --
 * Cross-feature imports (artifacts → chat). The tier rule's own remedy
 * ("promote shared code to components/widgets or lib/") cannot apply here: the
 * thing being reused is the chat surface itself — the shell context, the
 * history rail and the session screen, which pull in the controller, Apollo and
 * the AI SDK transport — and promoting that subsystem is a refactor of its own.
 * The alternative is forking it, which this plan explicitly forbids. The guest
 * chat shell makes the same reach (app/public/agents/[id]/components/
 * public-chat-shell.tsx); it simply sits outside a feature folder, so no rule
 * fires on it. Narrowed to these three imports on purpose. */
import {
  ChatShellContext,
  type ChatShellContextValue,
} from "@/app/(application)/chat/components/chat-shell";
import {
  HistoryRail,
  type HistoryRailPaths,
} from "@/app/(application)/chat/components/history-rail";
import { SessionScreen } from "@/app/(application)/chat/components/session-screen";
/* eslint-enable no-restricted-imports */
import {
  LG_QUERY,
  SidePanel,
  useMediaQuery,
} from "@/components/primitives/side-panel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Agent } from "@/types/models/agent";
import type { AgentSession } from "@/types/models/agent-session";

import { useTransientNavCollapse } from "./use-transient-nav-collapse";

export interface AgentPanelProps {
  agent: Agent;
  /** The session to open with, or null for a fresh chat. */
  initialSession: AgentSession | null;
  initialMessages: UIMessage[];
  /** The artifact's share name — the `[name]` of the page hosting this panel. */
  artifactName: string;
  /**
   * Mounted only while true. Closing unmounts the conversation (the turn
   * itself survives server-side — see the spec on `persistThroughDisconnect`);
   * to keep it mounted while giving the artifact its width back, the user
   * collapses the panel instead.
   */
  open: boolean;
  onClose: () => void;
  /**
   * The width in px this panel takes AWAY from the artifact, reported on mount
   * and on every resize: the dragged panel width when docked, the thin edge
   * when collapsed, and 0 below `lg` where the panel overlays instead. The
   * host turns it into the artifact's own viewport width for the channel. A
   * closed panel reports nothing (it is unmounted) — the host knows it closed
   * it.
   */
  onWidthChange: (width: number) => void;
  /**
   * Turn/tool progress for the artifact's channel. Declared here because the
   * chat controller exists ONLY inside this component — `SessionScreen`
   * instantiates it and the viewer page cannot reach it. Task 10 owns the hook
   * that fires it; nothing calls it yet.
   */
  onProgress: (reason: "tool" | "turn") => void;
}

export function AgentPanel({ open, ...rest }: AgentPanelProps) {
  // Unconditional (hook rules) and inert while closed: the app nav stands down
  // for as long as the panel is up, without writing the user's sidebar cookie.
  useTransientNavCollapse(open);
  if (!open) return null;
  return <MountedAgentPanel {...rest} />;
}

function MountedAgentPanel({
  agent,
  initialSession,
  initialMessages,
  artifactName,
  onClose,
  onWidthChange,
  // Accepted and deliberately unwired: Task 10 adds the emission (see the
  // prop's doc comment). Taking it now means the host can pass it from the
  // start and that wiring is a change inside this component only.
  onProgress,
}: Omit<AgentPanelProps, "open">) {
  const t = useTranslations("artifacts");
  const basePath = `/artifacts/open/${encodeURIComponent(artifactName)}`;

  const [collapsed, setCollapsed] = React.useState(false);
  // `undefined` until hydrated, so this is "we KNOW we are below lg" — the
  // same reading SidePanel itself takes of the same query (it exports both so
  // a host deciding how the panel behaves cannot drift from it).
  const sheetMode = useMediaQuery(LG_QUERY) === false;

  // --- what this panel takes from the artifact ------------------------------
  // Measured off this component's own root instead of read out of SidePanel:
  // the root is a flex child of the viewer's row, so a docked panel measures
  // its dragged width, a collapsed one measures the edge, and a Sheet — which
  // Radix portals out of the flow — measures 0 with no special case.
  const rootRef = React.useRef<HTMLDivElement>(null);
  const onWidthChangeRef = React.useRef(onWidthChange);
  React.useEffect(() => {
    onWidthChangeRef.current = onWidthChange;
  }, [onWidthChange]);

  React.useEffect(() => {
    const element = rootRef.current;
    if (!element) return;
    let reported: number | null = null;
    const report = () => {
      const width = Math.round(element.getBoundingClientRect().width);
      // Resize observers fire per frame during a drag; the host posts every
      // report into the artifact's port, so only send real changes.
      if (width === reported) return;
      reported = width;
      onWidthChangeRef.current(width);
    };
    report();
    // Guarded rather than assumed: a test environment without a ResizeObserver
    // still gets the mount report instead of a crash.
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(report);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // --- the alternate ChatShellContext --------------------------------------
  const [historySheetOpen, setHistorySheetOpen] = React.useState(false);
  // Starts collapsed: see the file header. Not persisted — the panel is a
  // transient surface beside an artifact, and borrowing the full page's
  // "chat.historyRail.collapsed" key would redecide that preference for it.
  const [railCollapsed, setRailCollapsed] = React.useState(true);
  const [newChatNonce, setNewChatNonce] = React.useState(0);

  // <lg opens the history Sheet, ≥lg toggles the docked rail — decided at
  // invocation time, mirroring ChatShell, so a resize between clicks always
  // targets the surface that is actually visible.
  const toggleHistory = React.useCallback(() => {
    const isDesktop =
      typeof window !== "undefined" && window.matchMedia(LG_QUERY).matches;
    if (isDesktop) {
      setRailCollapsed((prev) => !prev);
    } else {
      setHistorySheetOpen((prev) => !prev);
    }
  }, []);

  // The rail's New chat is a Link to `basePath`, so navigation is the caller's
  // job; the nonce is what makes the screen go pristine when that navigation
  // cannot (after a lazy create the URL was swapped with a raw replaceState the
  // router never saw, so pushing the bare URL diffs as "nothing changed").
  // SessionScreen keys itself on the nonce.
  const startNewChat = React.useCallback(() => {
    setHistorySheetOpen(false);
    setNewChatNonce((nonce) => nonce + 1);
  }, []);

  // Inert: ChatShell needs the lazy-create window to decide whether a New chat
  // click must bump the nonce, because its gate reads the router's `[session]`
  // segment. This host has no such segment and always bumps, so there is
  // nothing for the window to gate.
  const beginLazyCreate = React.useCallback(() => () => {}, []);

  const shell = React.useMemo<ChatShellContextValue>(
    () => ({
      agent,
      historySheetOpen,
      setHistorySheetOpen,
      railCollapsed,
      setRailCollapsed,
      toggleHistory,
      newChatNonce,
      startNewChat,
      // ChatHeader navigates on its own (its new-chat button, and the
      // after-delete return to a fresh chat); without this it would push
      // /chat/<agent>/new and take the user off the artifact page.
      newChatPath: basePath,
      beginLazyCreate,
    }),
    [
      agent,
      historySheetOpen,
      railCollapsed,
      toggleHistory,
      newChatNonce,
      startNewChat,
      basePath,
      beginLazyCreate,
    ],
  );

  const paths = React.useMemo<HistoryRailPaths>(
    () => ({
      session: (sessionId: string) =>
        `${basePath}?session=${encodeURIComponent(sessionId)}`,
      newChat: basePath,
      // No search page beside an artifact; the inline filter covers it.
      search: null,
    }),
    [basePath],
  );

  return (
    <ChatShellContext.Provider value={shell}>
      <div
        ref={rootRef}
        // State reflected the way components/ui/sidebar.tsx reflects its own,
        // so the collapse is inspectable from the DOM (host, tests, styling)
        // and not only from React state.
        data-state={collapsed ? "collapsed" : "expanded"}
        className="flex h-full min-h-0 shrink-0"
      >
        {collapsed ? (
          <div className="flex h-full w-8 shrink-0 items-center justify-center border-l bg-background">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label={t("panelExpand")}
              title={t("panelExpand")}
              onClick={() => setCollapsed(false)}
            >
              <PanelRightOpen aria-hidden="true" className="size-4" />
            </Button>
          </div>
        ) : null}

        {/* `hidden` while collapsed rather than unmounted: display:none keeps
            the controller, the message list and an in-flight stream alive, so
            expanding returns to the same conversation. The Sheet below lg is
            portalled out of this subtree, so hiding cannot reach it — there,
            collapsing closes the sheet instead and the edge above is the way
            back. */}
        <div className={cn("flex h-full min-h-0", collapsed && "hidden")}>
          <SidePanel
            open={collapsed ? !sheetMode : true}
            onOpenChange={(next) => {
              // SidePanel's own close affordances (the header X, Escape, a
              // sheet dismissal) mean close, not collapse.
              if (!next) onClose();
            }}
            title={agent.name}
            resizable
            storageKey="artifact-agent-panel"
            mobileSize="full"
            actions={
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 shrink-0"
                aria-label={t("panelCollapse")}
                title={t("panelCollapse")}
                onClick={() => setCollapsed(true)}
              >
                <PanelRightClose aria-hidden="true" className="size-4" />
              </Button>
            }
          >
            <div className="flex h-full min-h-0 w-full">
              <HistoryRail
                agent={agent}
                paths={paths}
                // URL-param driven here, not pathname: every session lives at
                // the same route.
                activeSessionId={initialSession?.id}
                // The slot picked the agent — switching it would open a
                // conversation the artifact never asked for.
                hideAgentSwitcher
              />
              <SessionScreen
                agent={agent}
                initialSession={initialSession}
                initialMessages={initialMessages}
                // The same URL the rail links a session to, deliberately:
                // where a session LIVES is where a freshly created one must
                // land. Read at call time by the controller
                // (hooks.ts sessionPathRef), so identity per render is free.
                sessionPath={paths.session}
              />
            </div>
          </SidePanel>
        </div>
      </div>
    </ChatShellContext.Provider>
  );
}
