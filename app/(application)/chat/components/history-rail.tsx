"use client";

/**
 * HistoryRail — chat history, one component with two renders (chat.md ladder
 * rows 9, 11–13, 16–18; "The Quiet Column", work item 2.3, owner "sessions"):
 *
 * - ≥lg: docked rail (`w-64`), collapsible via useChatShell().railCollapsed
 *   (persisted by the shell under "chat.historyRail.collapsed"); width
 *   animates 200 ms ease-in-out, reduced-motion safe.
 * - <lg: left Sheet (`w-[85vw] max-w-sm`), open via
 *   useChatShell().historySheetOpen — FULL parity with the rail (fixes U2:
 *   today phones have no history/new/search access at all).
 *
 * Contents (both renders): agent-name button → AgentSwitcherDialog (item 9),
 * New chat primary Button — the rail's ONLY purple — with the legacy in-flight
 * loading state preserved (item 11), rail OverflowMenu with "New named chat…"
 * (item 18 — revives the dormant create mode via an InputDialog-style dialog),
 * inline filter Input feeding useChatSessions search (item 12), Recents list
 * of SessionRows (item 13), "See all" → search page (items 12/16), 6 skeleton
 * rows + "No conversations yet" EmptyState (item 17).
 *
 * Replaces app/(application)/chat/[agent]/chat-sessions.tsx.
 */

import {
  ChevronsUpDown,
  MessagesSquare,
  PenLine,
  Plus,
  Search,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/primitives/empty-state";
import { Loading } from "@/components/primitives/loading";
import { OverflowMenu } from "@/components/primitives/overflow-menu";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Agent } from "@/types/models/agent";

import { useChatSessions, useSessionMutations } from "../hooks";
import { AgentSwitcherDialog } from "./agent-switcher-dialog";
import { useChatShell } from "./chat-shell";
import { SessionRow, type SessionListItem } from "./session-row";

/**
 * URL sites the rail navigates to. Defaulted (in the component) to the exact
 * internal /chat/... strings so internal chat is byte-identical; the public
 * guest shell passes its own /public/agents/... paths (?session=<sid>).
 */
export interface HistoryRailPaths {
  session: (sessionId: string) => string;
  newChat: string;
  /** null hides the "See all" link (public has no search page). */
  search: string | null;
}

export interface HistoryRailProps {
  agent: Agent;
  /** Default: current /chat/... URLs. */
  paths?: HistoryRailPaths;
  /** Overrides SessionRow's pathname matching (public is URL-param driven). */
  activeSessionId?: string;
  /** Public: the agent name is a plain label, no AgentSwitcherDialog. */
  hideAgentSwitcher?: boolean;
}

/** Recents cap — same 20 as the legacy sidebar (chat.md row 13). */
const RECENTS_LIMIT = 20;

export function HistoryRail({
  agent,
  paths,
  activeSessionId,
  hideAgentSwitcher,
}: HistoryRailProps) {
  const t = useTranslations("chat");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const pathname = usePathname();
  const { historySheetOpen, setHistorySheetOpen, railCollapsed, startNewChat } =
    useChatShell();

  // Defaults reproduce the exact internal literals so internal chat is
  // unchanged; the public shell overrides with its /public/agents paths.
  const resolvedPaths: HistoryRailPaths = paths ?? {
    session: (sessionId: string) => `/chat/${agent.id}/${sessionId}`,
    newChat: `/chat/${agent.id}/new`,
    search: `/chat/${agent.id}/search`,
  };

  // Inline filter (item 12): instant client-side narrowing of the loaded
  // recents, plus the debounced value feeding useChatSessions, whose server
  // title-contains filter engages from 3 chars (legacy 300 ms debounce kept).
  const [filterInput, setFilterInput] = React.useState("");
  const [filter, setFilter] = React.useState("");
  React.useEffect(() => {
    const id = setTimeout(() => setFilter(filterInput), 300);
    return () => clearTimeout(id);
  }, [filterInput]);

  const { sessions, itemCount, initialLoading } = useChatSessions({
    agentId: agent.id,
    search: filter,
    limit: RECENTS_LIMIT,
  });
  // ONE mutations instance, shared with every row (no per-row hook stacks).
  const mutations = useSessionMutations(agent.id);

  // New-chat in-flight state (item 11) — reset when the route changes,
  // exactly like the legacy sidebar.
  const [navigatingToNew, setNavigatingToNew] = React.useState(false);
  React.useEffect(() => {
    setNavigatingToNew(false);
  }, [pathname]);

  const [switcherOpen, setSwitcherOpen] = React.useState(false);
  const [namedOpen, setNamedOpen] = React.useState(false);
  const [namedTitle, setNamedTitle] = React.useState("");

  const items = sessions as unknown as SessionListItem[];
  const needle = filterInput.trim().toLowerCase();
  const visible = React.useMemo(() => {
    if (!needle) return items;
    return items.filter((session) =>
      (session.title || "").toLowerCase().includes(needle),
    );
  }, [items, needle]);

  // Item 18 — named session creation (the dormant "create" dialog mode,
  // revived deliberately per ladder row 18).
  const submitNamedChat = async () => {
    const title = namedTitle.trim();
    if (!title || mutations.creating) return;
    const session = await mutations.createNamedSession(title);
    if (!session) {
      toast.error(t("history.createFailed"));
      return;
    }
    toast.success(t("history.created"));
    setNamedOpen(false);
    setNamedTitle("");
    setHistorySheetOpen(false);
    router.push(resolvedPaths.session(session.id));
  };

  // Shared by the New-chat Link and the empty-state action. Next's Link runs
  // user onClick for modified clicks too (it only skips its own navigation),
  // so bail on cmd/ctrl/shift/alt/middle — the browser opens a new tab and
  // THIS tab must stay untouched.
  const handleNewChatClick = (
    event: React.MouseEvent<HTMLAnchorElement>,
    onNavigate?: () => void,
  ) => {
    if (
      event.defaultPrevented ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      event.button !== 0
    ) {
      return;
    }
    if (!pathname?.includes("/new")) {
      setNavigatingToNew(true);
    }
    // The Link alone is not enough: after a lazy session create the router
    // tree still reads "new" and this navigation no-ops (see
    // ChatShellContextValue.startNewChat).
    startNewChat();
    onNavigate?.();
  };

  const renderContent = (onNavigate?: () => void, inSheet = false) => (
    <div className="flex h-full min-h-0 w-full flex-col">
      {/* Header: agent identity is the switcher trigger (item 9) + rail menu.
          On public guest chat the name is a non-interactive label (no switcher). */}
      <div className={cn("flex items-center gap-1 p-2", inSheet && "pr-12")}>
        {hideAgentSwitcher ? (
          <div className="flex h-9 min-w-0 flex-1 items-center gap-2 px-2 max-md:h-11">
            <span className="truncate text-sm font-medium">{agent.name}</span>
          </div>
        ) : (
          <Button
            type="button"
            variant="ghost"
            onClick={() => setSwitcherOpen(true)}
            aria-label={t("history.switchAgent")}
            className="h-9 min-w-0 flex-1 justify-start gap-2 px-2 max-md:h-11"
          >
            <span className="truncate text-sm font-medium">{agent.name}</span>
            <ChevronsUpDown
              aria-hidden="true"
              className="size-4 shrink-0 text-muted-foreground"
            />
          </Button>
        )}
        <OverflowMenu
          label={t("history.menuLabel")}
          className="shrink-0 max-md:size-11"
          items={[
            {
              label: t("history.newNamedChat"),
              icon: PenLine,
              onSelect: () => setNamedOpen(true),
            },
          ]}
        />
      </div>

      {/* New chat — the rail's ONLY purple element (item 11). */}
      <div className="px-2 pb-2">
        <Button
          asChild
          className={cn(
            "w-full gap-2 max-md:h-11",
            navigatingToNew && "pointer-events-none opacity-70",
          )}
        >
          <Link
            href={resolvedPaths.newChat}
            aria-disabled={navigatingToNew || undefined}
            onClick={(event) => handleNewChatClick(event, onNavigate)}
          >
            {navigatingToNew ? (
              <Loading className="size-4" />
            ) : (
              <Plus aria-hidden="true" className="size-4" />
            )}
            {navigatingToNew ? tCommon("loading") : t("history.newChat")}
          </Link>
        </Button>
      </div>

      {/* Inline filter (item 12). */}
      <div className="px-2 pb-1">
        <div className="relative">
          <Search
            aria-hidden="true"
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            value={filterInput}
            onChange={(event) => setFilterInput(event.target.value)}
            placeholder={t("history.filterPlaceholder")}
            aria-label={t("history.filterPlaceholder")}
            className="h-9 pl-9 text-base max-md:h-11 md:text-sm"
          />
        </div>
      </div>

      <div className="px-3 pb-1 pt-2">
        <h3 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
          {t("history.recents")}
        </h3>
      </div>

      {/* Recents (item 13) + skeletons/empty (item 17) + See all (items 12/16). */}
      <nav
        aria-label={t("history.title")}
        className="min-h-0 flex-1 overflow-y-auto px-2 pb-2"
      >
        {initialLoading ? (
          <div className="flex flex-col gap-2 py-1" aria-hidden="true">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full rounded-md" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          needle ? (
            <EmptyState variant="quiet" title={t("history.noMatches")} />
          ) : (
            <EmptyState
              variant="quiet"
              icon={MessagesSquare}
              title={t("history.emptyTitle")}
              description={t("history.emptyDescription")}
              action={{
                label: t("history.newChat"),
                href: resolvedPaths.newChat,
                onClick: (event) => handleNewChatClick(event, onNavigate),
              }}
            />
          )
        ) : (
          <>
            <ul className="flex flex-col gap-0.5">
              {visible.map((session) => (
                <li key={session.id}>
                  <SessionRow
                    session={session}
                    agentId={agent.id}
                    mutations={mutations}
                    onNavigate={onNavigate}
                    href={resolvedPaths.session(session.id)}
                    active={
                      activeSessionId
                        ? session.id === activeSessionId
                        : undefined
                    }
                    newChatHref={resolvedPaths.newChat}
                  />
                </li>
              ))}
            </ul>
            {resolvedPaths.search !== null ? (
              <div className="pt-1">
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-muted-foreground max-md:h-11"
                >
                  <Link
                    href={resolvedPaths.search}
                    onClick={() => onNavigate?.()}
                  >
                    {itemCount > items.length
                      ? t("history.seeAllCount", { count: itemCount })
                      : t("history.seeAll")}
                  </Link>
                </Button>
              </div>
            ) : null}
          </>
        )}
      </nav>
    </div>
  );

  return (
    <>
      {/* ≥lg docked rail — width animates 200 ms (chat.md motion #3);
          collapsed content is inert so it leaves the tab order. */}
      <aside
        aria-label={t("history.title")}
        aria-hidden={railCollapsed || undefined}
        className={cn(
          "relative hidden h-full min-h-0 shrink-0 overflow-hidden transition-[width] duration-200 ease-in-out motion-reduce:transition-none lg:block",
          railCollapsed ? "w-0" : "w-64 border-r",
        )}
      >
        <div className="h-full w-64" inert={railCollapsed || undefined}>
          {renderContent()}
        </div>
      </aside>

      {/* <lg: left Sheet, full parity with the rail (fixes U2). */}
      <Sheet open={historySheetOpen} onOpenChange={setHistorySheetOpen}>
        <SheetContent
          side="left"
          className="flex w-[85vw] max-w-sm flex-col gap-0 p-0"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>{t("history.title")}</SheetTitle>
            <SheetDescription>{t("history.sheetDescription")}</SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 pb-[env(safe-area-inset-bottom)]">
            {renderContent(() => setHistorySheetOpen(false), true)}
          </div>
        </SheetContent>
      </Sheet>

      {/* Item 9 — agent switcher (replaces the dead "Back to agent selection"
          row). Skipped on public guest chat: no agent switching. */}
      {hideAgentSwitcher ? null : (
        <AgentSwitcherDialog open={switcherOpen} onOpenChange={setSwitcherOpen} />
      )}

      {/* Item 18 — "New named chat…" (InputDialog-style, Enter submits). */}
      <Dialog
        open={namedOpen}
        onOpenChange={(open) => {
          setNamedOpen(open);
          if (!open) setNamedTitle("");
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("history.namedChatTitle")}</DialogTitle>
            <DialogDescription>
              {t("history.namedChatDescription")}
            </DialogDescription>
          </DialogHeader>
          <Input
            value={namedTitle}
            onChange={(event) => setNamedTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void submitNamedChat();
              }
            }}
            placeholder={t("history.namedChatPlaceholder")}
            aria-label={t("history.namedChatPlaceholder")}
            className="text-base md:text-sm"
            autoFocus
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setNamedOpen(false)}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              onClick={() => void submitNamedChat()}
              disabled={mutations.creating || !namedTitle.trim()}
            >
              {mutations.creating ? (
                <Loading className="mr-2 size-4" />
              ) : null}
              {tCommon("create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
