"use client";

/**
 * RoutinesClient — top-level 'use client' container for /workflows (Routines).
 *
 * After the workbench promotion (work item: routine detail panel → routed
 * subpage at /workflows/[id]): this file no longer owns selection, the
 * detail panel, or the queue sheet. Row click navigates to the subpage;
 * RoutineEditorDialog, DeleteRoutineDialog and RunRoutineDialog stay
 * mounted here because they're still launched from row overflow actions
 * (Edit / View / Delete) and from the Quick-Run cell.
 *
 * Single-overlay invariant carried over for the dialogs still hosted here:
 * only one of {run, editor, delete} is active at a time. The Queue Sheet
 * moves to the subpage workbench (only one routine selected there).
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
import { RoutineEditorDialog } from "./components/routine-editor-dialog";
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

  // Editor (Save / Edit / View)
  const [editorState, setEditorState] = React.useState<
    | { mode: "edit" | "view"; routine: Routine }
    | null
  >(null);

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

  /* ---- Editor wiring ----------------------------------------------------- */

  const openEditor = (routine: Routine, mode: "edit" | "view") => {
    setEditorState({ mode, routine });
  };

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
            onRowClick={(routine) =>
              router.push(`/workflows/${routine.id}`)
            }
            onRun={(routine) => requestRun(routine)}
            onEdit={(routine) => openEditor(routine, "edit")}
            onView={(routine) => openEditor(routine, "view")}
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

      {/* Editor dialog */}
      {editorState ? (
        <RoutineEditorDialog
          isOpen={true}
          onClose={async () => {
            setEditorState(null);
            await refetch();
          }}
          messages={editorState.routine.steps_json ?? []}
          agentId={editorState.routine.agent}
          sessionTitle={editorState.routine.name}
          existingWorkflow={{
            id: editorState.routine.id,
            name: editorState.routine.name,
            description: editorState.routine.description ?? undefined,
            rights_mode: editorState.routine.rights_mode,
            // Domain RBAC -> editor RBAC: the legacy GraphQL schema typed
            // user ids as numbers; coerce defensively (the API returns
            // strings here and there). Roles/teams stay as strings.
            RBAC: {
              users: (editorState.routine.RBAC?.users ?? []).map((u) => ({
                id: Number(u.id),
                rights: u.rights,
              })),
              roles: (editorState.routine.RBAC?.roles ?? []).map((r) => ({
                id: String(r.id),
                rights: r.rights,
              })),
              teams: (editorState.routine.RBAC?.teams ?? []).map((tm) => ({
                id: String(tm.id),
                rights: tm.rights,
              })),
            },
            steps_json: editorState.routine.steps_json ?? undefined,
            agent: editorState.routine.agent,
          }}
          isReadOnly={editorState.mode === "view"}
        />
      ) : null}

      {/* Delete confirm */}
      <DeleteRoutineDialog
        routine={pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={handleDelete}
      />
    </PageShell>
  );
}
