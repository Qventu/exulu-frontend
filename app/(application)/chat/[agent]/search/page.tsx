"use client";

/**
 * /chat/[agent]/search — "Search conversations" (chat.md ladder rows 19–25;
 * "The Quiet Column", work item 2.3, owner "sessions").
 *
 * PageShell (content) + PageHeader with a breadcrumb back to
 * /chat/[agent]/new (item 19) + Toolbar (debounced ≥3-char title-contains
 * search via useChatSessions — same GET_AGENT_SESSIONS filters, item 20;
 * "Select" toggle entering selection mode, item 22; destructive bulk-delete
 * when rows are selected) + click-to-open rows with title + always-visible
 * RelativeTime (item 21) + bulk delete through the shared ConfirmDialog using
 * useSessionMutations.deleteSessions (item 23 — replaces the ad-hoc
 * AlertDialog) + "Show more (N of M)" (item 24) + skeletons and contextual
 * EmptyStates (item 25). Checkboxes render ONLY in select mode; select-all
 * spans writable rows only.
 *
 * The shell MobileTopbar stays on this route (suppression applies to chat
 * sessions only — navigation.md §5.3). The history rail/sheet renders beside
 * this page from the [agent] layout's ChatShell.
 */

import { ChevronRight, MessagesSquare, SearchX, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";

import { UserContext } from "@/app/(application)/authenticated";
import { ConfirmDialog } from "@/components/primitives/confirm-dialog";
import { EmptyState } from "@/components/primitives/empty-state";
import { PageHeader } from "@/components/primitives/page-header";
import { PageShell } from "@/components/primitives/page-shell";
import { RelativeTime } from "@/components/primitives/relative-time";
import { Toolbar } from "@/components/primitives/toolbar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { checkChatSessionWriteAccess } from "@/lib/check-chat-session-write-access";
import { cn } from "@/lib/utils";
import type { AgentSession } from "@/types/models/agent-session";

import { useChatShell } from "../../components/chat-shell";
import type { SessionListItem } from "../../components/session-row";
import { useChatSessions, useSessionMutations } from "../../hooks";

/** Same page size as the legacy search page. */
const PAGE_SIZE = 50;
/** Server title-contains search engages from 3 characters (item 20). */
const MIN_SEARCH_CHARS = 3;

export default function SearchPage({
  params,
}: {
  params: Promise<{ agent: string }>;
}) {
  const { agent: agentId } = React.use(params);
  const t = useTranslations("chat");
  const tCommon = useTranslations("common");
  const { user } = React.useContext(UserContext);
  // The [agent] layout wraps this route in ChatShell — the agent object backs
  // the breadcrumb label without an extra fetch.
  const { agent } = useChatShell();

  const [query, setQuery] = React.useState("");
  const [limit, setLimit] = React.useState(PAGE_SIZE);
  const [selectionMode, setSelectionMode] = React.useState(false);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const { sessions, itemCount, loading, initialLoading } = useChatSessions({
    agentId,
    search: query,
    limit,
  });
  const mutations = useSessionMutations(agentId);

  const items = sessions as unknown as SessionListItem[];

  const isWritable = React.useCallback(
    (session: SessionListItem) => {
      if (!user) return false;
      const sessionAgentId =
        typeof session.agent === "string" ? session.agent : session.agent?.id;
      return checkChatSessionWriteAccess(
        { ...session, agent: sessionAgentId } as AgentSession,
        user,
      );
    },
    [user],
  );

  const writableIds = React.useMemo(
    () => items.filter(isWritable).map((session) => session.id),
    [items, isWritable],
  );

  // Selection only ever references rows that still exist (deletes/refetches
  // prune it automatically).
  React.useEffect(() => {
    setSelected((prev) => {
      const next = new Set(
        Array.from(prev).filter((id) =>
          items.some((session) => session.id === id),
        ),
      );
      return next.size === prev.size ? prev : next;
    });
  }, [items]);

  const toggleSelectionMode = () => {
    if (selectionMode) setSelected(new Set());
    setSelectionMode(!selectionMode);
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const allSelected =
    writableIds.length > 0 && selected.size === writableIds.length;
  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(writableIds));
  };

  const trimmedQuery = query.trim();
  const searching = trimmedQuery.length >= MIN_SEARCH_CHARS;

  return (
    <div className="min-h-0 w-full flex-1 overflow-y-auto">
      <PageShell variant="content" className="max-w-3xl">
        {/* Item 19 — back to chat via the PageHeader breadcrumb. */}
        <PageHeader
          title={t("search.title")}
          breadcrumb={{
            label: agent.name,
            href: `/chat/${agentId}/new`,
          }}
        />

        <div className="space-y-2">
          {/* Item 20 (search, 300 ms debounce inside Toolbar) + item 22 (Select). */}
          <Toolbar
            search={{
              value: query,
              onChange: setQuery,
              placeholder: t("search.placeholder"),
            }}
            selection={
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-pressed={selectionMode}
                  onClick={toggleSelectionMode}
                  className="max-md:h-11"
                >
                  {selectionMode ? tCommon("cancel") : t("search.select")}
                </Button>
                {selectionMode && writableIds.length > 0 ? (
                  <div className="flex min-h-11 items-center gap-2 md:min-h-9">
                    <Checkbox
                      id="select-all-sessions"
                      checked={allSelected}
                      onCheckedChange={toggleAll}
                      aria-label={tCommon("selectAll")}
                    />
                    <Label
                      htmlFor="select-all-sessions"
                      className="cursor-pointer text-sm font-normal text-muted-foreground"
                    >
                      {tCommon("selectAll")}
                    </Label>
                  </div>
                ) : null}
                {selectionMode && selected.size > 0 ? (
                  <>
                    <span className="text-sm text-muted-foreground">
                      {tCommon("selectedCount", { count: selected.size })}
                    </span>
                    {/* Item 23 — bulk delete opens the shared ConfirmDialog. */}
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => setConfirmOpen(true)}
                      className="max-md:h-11"
                    >
                      <Trash2 aria-hidden="true" className="mr-2 size-4" />
                      {t("search.deleteCta", { count: selected.size })}
                    </Button>
                  </>
                ) : null}
              </div>
            }
          />
          {trimmedQuery.length > 0 &&
          trimmedQuery.length < MIN_SEARCH_CHARS ? (
            <p className="text-xs text-muted-foreground">
              {t("search.minChars")}
            </p>
          ) : null}
        </div>

        {/* Item 25 — skeletons mirror the row anatomy; empty states are contextual. */}
        {initialLoading ? (
          <div className="flex flex-col gap-2" aria-hidden="true">
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : items.length === 0 ? (
          searching ? (
            <EmptyState
              icon={SearchX}
              title={t("search.noMatchesTitle")}
              description={t("search.noMatchesDescription", {
                query: trimmedQuery,
              })}
            />
          ) : (
            <EmptyState
              icon={MessagesSquare}
              title={t("search.emptyTitle")}
              description={t("search.emptyDescription")}
              action={{
                label: t("history.newChat"),
                href: `/chat/${agentId}/new`,
              }}
            />
          )
        ) : (
          <div className="flex flex-col gap-2">
            {/* Item 21 — title + RelativeTime, click-to-open. */}
            <ul className="flex flex-col gap-2">
              {items.map((session) => {
                const writable = isWritable(session);
                const isSelected = selected.has(session.id);
                const rowContent = (
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {session.title || t("history.untitled")}
                    </p>
                    {session.updatedAt ? (
                      <RelativeTime
                        date={session.updatedAt}
                        className="text-xs text-muted-foreground"
                      />
                    ) : null}
                  </div>
                );

                return (
                  <li key={session.id}>
                    {selectionMode && writable ? (
                      // Item 22 — checkboxes exist only in select mode; the
                      // whole row is the toggle target (T1 bulk selection).
                      <button
                        type="button"
                        onClick={() => toggleOne(session.id)}
                        aria-pressed={isSelected}
                        className={cn(
                          "flex min-h-11 w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                          isSelected ? "bg-muted" : "hover:bg-accent",
                        )}
                      >
                        <Checkbox
                          checked={isSelected}
                          tabIndex={-1}
                          aria-hidden="true"
                          className="pointer-events-none shrink-0"
                        />
                        {rowContent}
                      </button>
                    ) : (
                      <Link
                        href={`/chat/${agentId}/${session.id}`}
                        className="flex min-h-11 w-full items-center gap-3 rounded-lg border p-3 transition-colors duration-150 hover:bg-accent motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        {rowContent}
                        <ChevronRight
                          aria-hidden="true"
                          className="size-4 shrink-0 text-muted-foreground"
                        />
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>

            {/* Item 24 — "Show more (N of M)". */}
            {items.length < itemCount ? (
              <Button
                type="button"
                variant="outline"
                className="w-full max-md:h-11"
                disabled={loading}
                onClick={() => setLimit((previous) => previous + PAGE_SIZE)}
              >
                {loading
                  ? tCommon("loading")
                  : t("search.showMore", {
                      shown: items.length,
                      total: itemCount,
                    })}
              </Button>
            ) : null}
          </div>
        )}

        {/* Item 23 — the shared ConfirmDialog (replaces the AlertDialog). */}
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title={t("search.deleteTitle", { count: selected.size })}
          description={t("search.deleteDescription", { count: selected.size })}
          confirmLabel={tCommon("delete")}
          onConfirm={async () => {
            const ids = Array.from(selected);
            const { deleted, failed } = await mutations.deleteSessions(ids);
            if (failed > 0) {
              toast.error(t("search.deletePartial", { deleted, failed }));
            } else {
              toast.success(t("search.deleteSuccess", { count: deleted }));
            }
            setSelected(new Set());
            setSelectionMode(false);
          }}
        />
      </PageShell>
    </div>
  );
}
