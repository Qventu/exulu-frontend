"use client";

/**
 * RoutinesClient — top-level 'use client' container for /workflows (Routines).
 *
 * After work item 2.13 (RoutineEditorDialog reduced to CREATE-only), the row
 * Edit / View actions navigate to the subpage at /workflows/[id]. The list
 * page no longer hosts the editor dialog at all — chat is the only consumer
 * of the dialog now, and it imports it via the shared barrel.
 *
 * Single-overlay invariant still applies to {run, delete}: the Quick-Run cell
 * and the row overflow "Delete" still launch overlays here.
 *
 * NO primary action on the PageHeader: routines are created exclusively from
 * chat (workflows.md §3). The EmptyState carries the "Open chat" link; the
 * mobile topbar surfaces a quiet "Open chat" shortcut.
 */

import { MessageSquare } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import { UserContext } from "@/app/(application)/authenticated";
import { PageHeader } from "@/components/primitives/page-header";
import { PageShell } from "@/components/primitives/page-shell";
import { MobileTopbarAction } from "@/components/shell/mobile-topbar";
import { Button } from "@/components/ui/button";

import { routineAccess } from "./access";
import { RoutineList } from "./components/routine-list";
import { RoutineToolbar } from "./components/routine-toolbar";
import { RoutinesEmptyState } from "./components/empty-state";
import { DeleteRoutineDialog } from "./components/delete-routine-dialog";
import { RunRoutineDialog } from "./components/run-routine-dialog";
import {
  useAgentsForPage,
  useLastRunForPage,
  useRoutineMutations,
  useRoutinesIndex,
  useSchedulesForPage,
} from "./hooks";
import type {
  Routine,
  RoutineAccess,
  RunRoutineRequest,
} from "./types";

export function RoutinesClient() {
  const t = useTranslations("routines");
  const { user } = React.useContext(UserContext);
  const router = useRouter();

  const {
    items,
    pageInfo,
    loading,
    error,
    refetch,
    page: _page,
    setPage,
    search,
    setSearch,
  } = useRoutinesIndex();

  // Batched lookups for the visible page — replace per-row queries.
  const agentIds = React.useMemo(
    () => items.map((r) => r.agent).filter(Boolean),
    [items],
  );
  const workflowIds = React.useMemo(() => items.map((r) => r.id), [items]);

  const agents = useAgentsForPage(agentIds);
  const lastRunById = useLastRunForPage(workflowIds);
  const scheduleById = useSchedulesForPage(workflowIds);

  // Run dialog request (still page-level — Quick-Run cell + row overflow Run).
  const [runRequest, setRunRequest] = React.useState<RunRoutineRequest | null>(
    null,
  );

  // Delete dialog target
  const [pendingDelete, setPendingDelete] = React.useState<Routine | null>(
    null,
  );

  const { removeRoutine } = useRoutineMutations();

  // Access computation per routine.
  const accessFor = React.useCallback(
    (routine: Routine): RoutineAccess => routineAccess(routine, user),
    [user],
  );

  // Resolve queueName via the agents map (used for run dialog wiring).
  const queueNameOf = React.useCallback(
    (routine: Routine): string | null =>
      agents[routine.agent]?.queueName ?? null,
    [agents],
  );

  /* ---- Run wiring -------------------------------------------------------- */

  const requestRun = React.useCallback(
    (routine: Routine, prefill?: Record<string, string>) => {
      const queue = queueNameOf(routine) ?? undefined;
      const variables = (routine.variables ?? []) as string[];
      setRunRequest({
        id: routine.id,
        queue,
        variables,
        prefill,
        routineName: routine.name,
      });
    },
    [queueNameOf],
  );

  /* ---- Edit/View wiring — navigation to the subpage --------------------- */

  const openSubpage = React.useCallback(
    (routine: Routine) => {
      router.push(`/workflows/${routine.id}`);
    },
    [router],
  );

  /* ---- Delete wiring ----------------------------------------------------- */

  const handleDelete = React.useCallback(
    async (id: string) => {
      await removeRoutine(id);
      setPendingDelete(null);
      await refetch();
    },
    [removeRoutine, refetch],
  );

  /* ---- Render branches --------------------------------------------------- */

  const showEmptyInitial =
    !loading &&
    !error &&
    items.length === 0 &&
    search.trim().length === 0;

  const isFiltered = search.trim().length > 0;

  const countSlot =
    !loading && pageInfo ? (
      <span className="hidden text-sm text-muted-foreground md:inline">
        {t("countLabel", { count: pageInfo.itemCount })}
      </span>
    ) : null;

  return (
    <PageShell variant="content">
      <MobileTopbarAction>
        <Button asChild size="sm" variant="ghost">
          <Link href="/chat">
            <MessageSquare aria-hidden="true" className="mr-1 size-4" />
            {t("openChat")}
          </Link>
        </Button>
      </MobileTopbarAction>

      <PageHeader title={t("title")} description={t("description")} />

      <div className="flex flex-col gap-3">
        <RoutineToolbar
          search={search}
          onSearchChange={setSearch}
          countSlot={countSlot}
        />

        {showEmptyInitial ? (
          <div className="rounded-md border bg-card p-8">
            <RoutinesEmptyState />
          </div>
        ) : (
          <RoutineList
            items={items}
            loading={loading}
            error={
              error
                ? {
                    message: error.message,
                    onRetry: () => refetch(),
                  }
                : null
            }
            pageInfo={pageInfo}
            onPageChange={setPage}
            lastRunById={lastRunById}
            scheduleById={scheduleById}
            accessFor={accessFor}
            onRowClick={openSubpage}
            onRun={(routine) => requestRun(routine)}
            onEdit={openSubpage}
            onView={openSubpage}
            onDelete={(routine) => setPendingDelete(routine)}
            emptyTitle={
              isFiltered ? t("emptyFilteredTitle") : t("emptyTitle")
            }
            emptyDescription={
              isFiltered ? t("emptyFilteredDescription") : t("emptyDescription")
            }
            emptyAction={
              isFiltered
                ? { label: t("clearSearch"), onClick: () => setSearch("") }
                : { label: t("openChat"), href: "/chat" }
            }
          />
        )}
      </div>

      {/* Run dialog (page-level — Quick-Run + row overflow Run) */}
      <RunRoutineDialog
        request={runRequest}
        onClose={async () => {
          setRunRequest(null);
          await refetch();
        }}
      />

      {/* Delete confirm */}
      <DeleteRoutineDialog
        routine={pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={handleDelete}
      />
    </PageShell>
  );
}
