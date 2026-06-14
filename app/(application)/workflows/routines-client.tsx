"use client";

/**
 * RoutinesClient — top-level 'use client' container for /workflows (Routines).
 *
 * Owns: list query (useRoutinesIndex), batched agent/lastRun/schedule lookups,
 * selection state (panel + run dialog + queue sheet), the four route-level
 * dialog/sheet mount points, and the mobile topbar action.
 *
 * Single-overlay invariant (architect risk): the page tracks exactly ONE
 * active overlay state at a time — opening the run dialog closes the queue
 * sheet and vice versa.
 *
 * NO primary action on the PageHeader: routines are created exclusively from
 * chat (workflows.md §3). The EmptyState carries the "Open chat" link; the
 * mobile topbar surfaces a quiet "Open chat" shortcut.
 */

import { useMutation } from "@apollo/client";
import { MessageSquare } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";

import { UserContext } from "@/app/(application)/authenticated";
import { ListDetail } from "@/components/primitives/list-detail";
import { PageHeader } from "@/components/primitives/page-header";
import { PageShell } from "@/components/primitives/page-shell";
import { QueuePanel } from "@/components/primitives/queue-panel";
import { MobileTopbarAction } from "@/components/shell/mobile-topbar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import { routineAccess } from "./access";
import { RoutineEditorDialog } from "./components/routine-editor-dialog";
import { RoutineList } from "./components/routine-list";
import { RoutinePanel } from "./components/routine-panel";
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
import { RUN_WORKFLOW } from "./queries";
import type {
  Routine,
  RoutineAccess,
  RunRoutineRequest,
} from "./types";

export function RoutinesClient() {
  const t = useTranslations("routines");
  const { user } = React.useContext(UserContext);

  // Page-level RUN_WORKFLOW for non-interactive queue retries (workflows.md
  // ladder #26 / #33). Inline mutation avoids the dialog overwrite bug.
  const [runWorkflowMutation] = useMutation(RUN_WORKFLOW);

  const {
    items,
    pageInfo,
    loading,
    error,
    refetch,
    page,
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

  // Single-source-of-truth overlay state (architect risk).
  type Overlay =
    | { kind: "none" }
    | { kind: "run"; request: RunRoutineRequest }
    | { kind: "queue"; queueName: string };
  const [overlay, setOverlay] = React.useState<Overlay>({ kind: "none" });

  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const selected = React.useMemo(
    () => items.find((r) => r.id === selectedId) ?? null,
    [items, selectedId],
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

  // Keep selection valid after refetch
  React.useEffect(() => {
    if (!selectedId) return;
    if (items.find((r) => r.id === selectedId)) return;
    setSelectedId(null);
  }, [items, selectedId]);

  // Access computation per routine.
  const accessFor = React.useCallback(
    (routine: Routine): RoutineAccess => routineAccess(routine, user),
    [user],
  );

  // Resolve agentName / queueName via the agents map.
  const agentNameOf = React.useCallback(
    (routine: Routine): string | null => agents[routine.agent]?.name ?? null,
    [agents],
  );
  const queueNameOf = React.useCallback(
    (routine: Routine): string | null =>
      agents[routine.agent]?.queueName ?? null,
    [agents],
  );

  /* ---- Run wiring -------------------------------------------------------- */

  const requestRun = React.useCallback(
    (
      routine: Routine,
      prefill?: Record<string, string>,
    ) => {
      const queue = queueNameOf(routine) ?? undefined;
      const variables = (routine.variables ?? []) as string[];
      setOverlay({
        kind: "run",
        request: {
          id: routine.id,
          queue,
          variables,
          prefill,
          routineName: routine.name,
        },
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
      if (selectedId === id) setSelectedId(null);
      setPendingDelete(null);
      await refetch();
    },
    [removeRoutine, refetch, selectedId],
  );

  /* ---- Queue sheet (page-level) ----------------------------------------- */

  const openQueueSheet = (queueName: string) => {
    setOverlay({ kind: "queue", queueName });
  };

  /* ---- Render branches --------------------------------------------------- */

  const showEmptyInitial =
    !loading &&
    !error &&
    items.length === 0 &&
    search.trim().length === 0;

  const isFiltered = search.trim().length > 0;

  // List region. When the initial list is empty (no search), DataTable's
  // empty slot renders a stylish full EmptyState; when filtered-empty we
  // show the "no match" variant via the same primitive.
  const listRegion = (
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
      onRowClick={(routine) => setSelectedId(routine.id)}
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
  );

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
          // No outer card chrome — DataTable already wraps itself in a
          // `rounded-md border` shell (2026-06-14 QA: outer + inner card
          // looked card-in-card; flex container is enough here).
          <div className="flex min-h-[60vh] overflow-hidden lg:min-h-[calc(100dvh-18rem)]">
            <ListDetail<Routine>
              detailMode="panel"
              detailPresentation="docked"
              // "compact" (default): list flex-1, detail w-96/xl:w-[28rem].
              // The routines list is a multi-column TABLE; "primary" was
              // squeezing every column into multi-line rows on detail open.
              detailEmphasis="compact"
              items={items}
              selected={selected}
              onSelect={(item) => setSelectedId(item ? item.id : null)}
              detailTitle={(item) => item.name}
              detail={(item) => {
                const access = accessFor(item);
                return (
                  <RoutinePanel
                    routine={item}
                    access={access}
                    agentName={agentNameOf(item)}
                    queueName={queueNameOf(item)}
                    onRun={() => requestRun(item)}
                    onEdit={() => openEditor(item, "edit")}
                    onView={() => openEditor(item, "view")}
                    onDelete={() => setPendingDelete(item)}
                    onManageQueue={openQueueSheet}
                  />
                );
              }}
              emptyDetail={
                <div className="flex h-full w-full items-center justify-center p-6">
                  <RoutinesEmptyState
                    filtered={isFiltered}
                    onClearFilter={
                      isFiltered ? () => setSearch("") : undefined
                    }
                  />
                </div>
              }
              list={listRegion}
              className="w-full"
            />
          </div>
        )}
      </div>

      {/* Run dialog (page-level) */}
      <RunRoutineDialog
        request={overlay.kind === "run" ? overlay.request : null}
        onClose={async () => {
          setOverlay({ kind: "none" });
          await refetch();
        }}
      />

      {/* Queue sheet (page-level) */}
      <Sheet
        open={overlay.kind === "queue"}
        onOpenChange={(open) => {
          if (!open) setOverlay({ kind: "none" });
        }}
      >
        <SheetContent
          side="right"
          className="w-full overflow-y-auto sm:max-w-2xl"
        >
          <SheetHeader>
            <SheetTitle>
              {overlay.kind === "queue"
                ? t("queue.sheetTitle", { name: overlay.queueName })
                : t("queue.title")}
            </SheetTitle>
          </SheetHeader>
          {overlay.kind === "queue" ? (
            <div className="mt-4">
              <QueuePanel
                queueName={overlay.queueName}
                displayName={overlay.queueName}
                canWrite={true}
                enableDeleteOriginalAfterRetry={true}
                nameGenerator={(job) => {
                  const data = job.data as { workflow?: string } | undefined;
                  return `${t("queue.runPrefix")} ${data?.workflow ?? job.id}`;
                }}
                retryJob={async (job) => {
                  const data = job.data as
                    | {
                        workflow?: string;
                        inputs?: Record<string, string>;
                      }
                    | undefined;
                  if (!data?.workflow) {
                    toast.error(t("queue.toast.cannotRetry"));
                    return true;
                  }
                  // Non-interactive retry via RUN_WORKFLOW with original
                  // inputs (workflows.md ladder #26). Mirrors evals'
                  // direct-mutation retry — never opens the run dialog,
                  // never overwrites overlay state on bulk retry.
                  try {
                    await runWorkflowMutation({
                      variables: {
                        id: data.workflow,
                        variables: data.inputs ?? {},
                      },
                    });
                  } catch (err) {
                    toast.error(t("toast.runFailed"), {
                      description: (err as Error).message,
                    });
                  }
                  return true;
                }}
              />
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

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
