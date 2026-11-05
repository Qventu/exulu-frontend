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
 * its own root rather than asking the panel how wide it thinks it is. The
 * collapse control and the edge are therefore NOT offered there: collapse
 * buys the artifact no width when the panel never took any, and a Sheet's
 * content is portalled out of this subtree, so hiding cannot reach it — the
 * control would have to close the sheet, which Radix unmounts, discarding the
 * conversation a control labelled "collapse" just promised to keep. Below
 * `lg` the X is the right and only affordance.
 *
 * Must be mounted inside the app shell's `SidebarProvider`: it collapses the
 * nav for as long as it is open, and the hook that does that reads the sidebar
 * context unconditionally — so `AgentPanel` needs the provider even while
 * `open` is false.
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
 * fires on it. Narrowed to these four imports on purpose — the fourth
 * (`ChatSessionController`, task 9) is a TYPE ONLY, for the ref that receives
 * the live controller instance via SessionScreen's `onController` (see that
 * prop's doc comment): an artifact's `exulu:panel:open` request has to reach
 * the mounted controller, and this is the only place that controller is ever
 * exposed outside the chat feature. */
import {
  ChatShellContext,
  type ChatShellContextValue,
} from "@/app/(application)/chat/components/chat-shell";
import {
  HistoryRail,
  type HistoryRailPaths,
} from "@/app/(application)/chat/components/history-rail";
import { SessionScreen } from "@/app/(application)/chat/components/session-screen";
import type { ChatSessionController } from "@/app/(application)/chat/hooks";
/* eslint-enable no-restricted-imports */
import {
  LG_QUERY,
  SidePanel,
  useMediaQuery,
} from "@/components/primitives/side-panel";
import { Button } from "@/components/ui/button";
import type { OpenPanelRequest } from "@/lib/artifacts/agent-panel-protocol";
import { cn } from "@/lib/utils";
import type { Agent } from "@/types/models/agent";
import type { AgentSession } from "@/types/models/agent-session";

import { applyOpenRequest } from "./apply-open-request";
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
   * Called on mount and on every resize with the width in px THIS PANEL
   * occupies: the dragged panel width when docked, the thin edge when
   * collapsed, and 0 below `lg` where the panel overlays the artifact instead
   * of squeezing it. A closed panel reports nothing (it is unmounted) — the
   * host knows it closed it.
   *
   * It is **not** the number the host puts on the artifact channel. The
   * artifact is told the width IT has (spec: "the parent posts the artifact's
   * new viewport width over the port so the artifact can reflow itself"),
   * which the host measures off the artifact's own box — a panel width cannot
   * answer "do I still have room for three columns?" without the total, and
   * the docked → Sheet breakpoint flip can change the artifact's width with
   * no call to this at all. A host wanting the artifact's width must measure
   * the artifact; `viewer-client.tsx` does.
   *
   * So what this is FOR is the call, not the number: a collapse is a change
   * this component makes, and reporting it lets the host re-measure in the
   * same commit instead of waiting for its own observer's next frame. The
   * width stays in the signature because it is a measured fact about this
   * component that its own tests assert per state (400 docked, 32 collapsed,
   * 0 in sheet mode) — that is the proof the geometry is read correctly, and
   * dropping the parameter would delete it.
   */
  onWidthChange: (width: number) => void;
  /**
   * Turn/tool progress for the artifact's channel. Declared here because the
   * chat controller exists ONLY inside this component — `SessionScreen`
   * instantiates it and the viewer page cannot reach it. Task 10 owns the hook
   * that fires it; nothing calls it yet.
   */
  onProgress: (reason: "tool" | "turn") => void;
  /**
   * An artifact's `exulu:panel:open` request (task 4's `OpenPanelRequest`),
   * tagged with a nonce by the viewer every time it fires. Applied against
   * the mounted controller via `applyOpenRequest` — prefilling the composer
   * and/or attaching files, never sending.
   *
   * Nonce-tagged rather than passed as the bare request so a SECOND request
   * for the SAME slot, while this exact panel instance stays mounted (the
   * artifact's button can be clicked more than once without the panel
   * closing in between), is still detected as a fresh event — a value
   * comparison on the request object would see no change and silently drop
   * it. `null` while nothing is pending; a request already applied is not
   * re-applied on an unrelated re-render (tracked by nonce, not identity).
   */
  openRequest: { request: OpenPanelRequest; nonce: number } | null;
}

/** Mount inside `SidebarProvider` — see the file header's last paragraph. */
export function AgentPanel({ open, ...rest }: AgentPanelProps) {
  // Unconditional (hook rules) and inert while closed: the app nav stands down
  // for as long as the panel is up, without writing the user's sidebar cookie.
  // This is also why the provider is required even when `open` is false.
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
  openRequest,
}: Omit<AgentPanelProps, "open">) {
  const t = useTranslations("artifacts");
  const basePath = `/artifacts/open/${encodeURIComponent(artifactName)}`;

  // --- reaching the controller SessionScreen instantiates below ------------
  // The only handle this component ever gets on it: SessionScreenInner calls
  // this every render (see SessionScreenProps.onController's doc comment),
  // so the ref is always the current instance. A plain ref rather than
  // state on purpose — updating it must not itself cause a re-render, and
  // nothing here needs to react to the controller changing, only to read it
  // when an openRequest arrives.
  const controllerRef = React.useRef<ChatSessionController | null>(null);
  const handleController = React.useCallback(
    (controller: ChatSessionController) => {
      controllerRef.current = controller;
    },
    [],
  );

  // Applies at most once per nonce. React fires a child's effects before its
  // parent's within the same commit, and SessionScreen (a descendant of this
  // component) is ALWAYS mounted whenever this component is — even while
  // `collapsedNow` hides it with `display:none` below, never unmounted — so
  // `controllerRef.current` is already set by the time this effect runs,
  // including on the very first commit where the panel opens with a request
  // already pending.
  const appliedNonceRef = React.useRef<number | null>(null);
  React.useEffect(() => {
    if (!openRequest) return;
    if (appliedNonceRef.current === openRequest.nonce) return;
    appliedNonceRef.current = openRequest.nonce;
    const controller = controllerRef.current;
    if (!controller) return;
    void applyOpenRequest(openRequest.request, {
      seedInput: controller.seedInput,
      addSessionItems: controller.addSessionItems,
      addSessionFiles: controller.addSessionFiles,
      setFilesPanelOpen: controller.setFilesPanelOpen,
    });
  }, [openRequest]);

  const [collapsed, setCollapsed] = React.useState(false);
  // `undefined` until hydrated, so this is "we KNOW we are below lg" — the
  // same reading SidePanel itself takes of the same query (it exports both so
  // a host deciding how the panel behaves cannot drift from it).
  const sheetMode = useMediaQuery(LG_QUERY) === false;
  // Collapse is a ≥lg affordance only (see the file header). Deriving it
  // instead of guarding each use also settles the resize case: a panel
  // collapsed on a wide window that is then narrowed past lg comes back as the
  // Sheet rather than vanishing behind an edge that is no longer rendered.
  const collapsedNow = collapsed && !sheetMode;

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

  const reportedWidthRef = React.useRef<number | null>(null);
  const reportWidth = React.useCallback(() => {
    const element = rootRef.current;
    if (!element) return;
    const width = Math.round(element.getBoundingClientRect().width);
    // Resize observers fire per frame during a drag; the host posts every
    // report into the artifact's port, so only send real changes.
    if (width === reportedWidthRef.current) return;
    reportedWidthRef.current = width;
    onWidthChangeRef.current(width);
  }, []);

  // Keyed on the collapse so a state change THIS component made is reported in
  // the same commit, rather than waiting for the observer's next frame — the
  // artifact reflows off these numbers. The observer still covers the changes
  // this component does not make: a resize drag, a breakpoint flip.
  React.useEffect(() => {
    const element = rootRef.current;
    if (!element) return;
    reportWidth();
    // Guarded rather than assumed: a test environment without a ResizeObserver
    // still gets the mount report instead of a crash.
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(reportWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, [collapsedNow, reportWidth]);

  // --- focus must not fall on the floor -------------------------------------
  // Collapsing puts the focused collapse button inside a display:none subtree,
  // and expanding takes the edge button away — in both directions activeElement
  // would fall back to <body>, and SidePanel's own focus effect cannot help
  // because its `open` never changes. So hand focus to whichever control
  // replaced the one that just went away.
  const edgeButtonRef = React.useRef<HTMLButtonElement>(null);
  const collapseButtonRef = React.useRef<HTMLButtonElement>(null);
  const collapseSettledRef = React.useRef(false);
  React.useEffect(() => {
    // Not on mount: there SidePanel moves focus into the panel itself, and
    // stealing it to a control would undo that.
    if (!collapseSettledRef.current) {
      collapseSettledRef.current = true;
      return;
    }
    if (collapsedNow) edgeButtonRef.current?.focus();
    else collapseButtonRef.current?.focus();
  }, [collapsedNow]);

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
        data-state={collapsedNow ? "collapsed" : "expanded"}
        className="flex h-full min-h-0 shrink-0"
      >
        {collapsedNow ? (
          <div className="flex h-full w-8 shrink-0 items-center justify-center border-l bg-background">
            <Button
              ref={edgeButtonRef}
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
            expanding returns to the same conversation. Below lg this never
            applies (`collapsedNow` is false there by construction), which is
            the point: a Sheet's content is portalled out of this subtree, so
            hiding could not reach it and the only way to "collapse" it would
            be to close it — and Radix unmounts closed sheet content, throwing
            away exactly what the control promises to keep. */}
        <div className={cn("flex h-full min-h-0", collapsedNow && "hidden")}>
          <SidePanel
            // Always open: a collapse is the `hidden` above, never a close, so
            // the Sheet below lg can never be the thing that swallows the
            // conversation.
            open
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
              // Not offered in Sheet mode — see the file header.
              sheetMode ? undefined : (
                <Button
                  ref={collapseButtonRef}
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
              )
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
                // task 9: the only way this component ever gets a handle on
                // the controller it has no other reach into.
                onController={handleController}
              />
            </div>
          </SidePanel>
        </div>
      </div>
    </ChatShellContext.Provider>
  );
}
