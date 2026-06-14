"use client";

/**
 * RoutineWorkbench — /workflows/[id] client root.
 *
 * Mirrors the agents EditorView shape exactly:
 *  PageShell variant="content"
 *    RoutineHeader (PageHeader w/ breadcrumb, leading icon, agent + visibility,
 *                   Run primary + OverflowMenu Edit/View/Copy ID/Delete)
 *    Separator
 *    grid gap-8 lg:grid-cols-[200px_1fr]
 *      SectionNav (sticky lg+, chip row <lg) wired to useScrollSpy
 *      div.min-w-0 > div.mx-auto.max-w-3xl.space-y-12 >
 *        <OverviewSection ... />   (id="overview")
 *        <RunsSection ... />       (id="runs")
 *        <ScheduleSection ... />   (id="schedule")
 *        <QueueSection ... />      (id="queue")
 *    Subpage-local overlays (single-overlay invariant):
 *      RunRoutineDialog (Run button + Runs row "Retry")
 *      Queue Sheet (Manage queue)
 *      DeleteRoutineDialog (Overflow Delete)
 *      RoutineEditorDialog (Overflow Edit/View)
 *
 * No SaveBar / useUnsavedChangesGuard — routines are not edited in place;
 * the RoutineEditorDialog is the editor surface.
 *
 * useScrollSpy is re-exported from the agents workbench (../hooks.ts) — the
 * 2026-06-13 findScrollParent walk MUST remain the single source of truth.
 *
 * ROUTINE_SECTION_IDS is the authoritative section order. The JSX below
 * MUST render <section id={...}> in the same order so the default activeId
 * (sectionIds[0] = "overview") matches what the user actually sees first.
 */

import { useMutation } from "@apollo/client";
import { MessageSquare } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import { MobileTopbarAction } from "@/components/shell/mobile-topbar";
import Link from "next/link";

import { PageShell } from "@/components/primitives/page-shell";
import { QueuePanel } from "@/components/primitives/queue-panel";
import { SectionNav } from "@/components/primitives/section-nav";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import { DeleteRoutineDialog } from "../../components/delete-routine-dialog";
import { RoutineEditorDialog } from "../../components/routine-editor-dialog";
import { RunRoutineDialog } from "../../components/run-routine-dialog";
import { RUN_WORKFLOW } from "../../queries";
import type { Routine } from "../../types";
import { useRoutineWorkbench, useScrollSpy } from "../hooks";
import { OverviewSection } from "../sections/overview";
import { QueueSection } from "../sections/queue";
import { RunsSection } from "../sections/runs";
import { ScheduleSection } from "../sections/schedule";
import { RoutineHeader } from "./routine-header";

export const ROUTINE_SECTION_IDS = [
  "overview",
  "runs",
  "schedule",
  "queue",
] as const;
export type RoutineSectionId = (typeof ROUTINE_SECTION_IDS)[number];
export const DEFAULT_ROUTINE_SECTION: RoutineSectionId = "overview";

export interface RoutineWorkbenchProps {
  routine: Routine;
}

export function RoutineWorkbench({ routine }: RoutineWorkbenchProps) {
  const t = useTranslations("routines");
  const workbench = useRoutineWorkbench(routine);
  const activeId = useScrollSpy(ROUTINE_SECTION_IDS as unknown as string[]);

  // Subpage-local non-interactive retry for the Queue panel (workflows.md
  // ladder #26 / #33). Inline mutation avoids the dialog-overwrite bug.
  const [runWorkflowMutation] = useMutation(RUN_WORKFLOW);

  const sections = React.useMemo(
    () =>
      ROUTINE_SECTION_IDS.map((id) => ({
        id,
        label: t(`tabs.${id}` as const),
      })),
    [t],
  );

  const handleSelect = React.useCallback((id: string) => {
    const target = document.getElementById(id);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    // Move focus to the section heading for keyboard / screen-reader users.
    target.setAttribute("tabindex", "-1");
    (target as HTMLElement).focus({ preventScroll: true });
  }, []);

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

      <RoutineHeader
        routine={routine}
        access={workbench.access}
        agentName={workbench.agentName}
        onRun={() => workbench.openRun()}
        onEdit={() => workbench.openEditor("edit")}
        onView={() => workbench.openEditor("view")}
        onDelete={() => workbench.setDeleteOpen(true)}
      />

      <Separator />

      <div className="grid gap-8 lg:grid-cols-[200px_1fr]">
        <SectionNav
          sections={sections}
          activeId={activeId}
          onSelect={handleSelect}
        />

        <div className="min-w-0">
          <div className="mx-auto max-w-3xl space-y-12">
            <OverviewSection routine={routine} />
            <RunsSection
              routine={routine}
              onRetry={(prefill) => workbench.openRun(prefill)}
            />
            <ScheduleSection routine={routine} access={workbench.access} />
            <QueueSection
              queueName={workbench.queueName}
              onManageQueue={workbench.openQueue}
            />
          </div>
        </div>
      </div>

      {/* Run dialog (single overlay invariant) */}
      <RunRoutineDialog
        request={
          workbench.overlay.kind === "run" ? workbench.overlay.request : null
        }
        onClose={workbench.closeOverlay}
      />

      {/* Queue sheet (single overlay invariant) */}
      <Sheet
        open={workbench.overlay.kind === "queue"}
        onOpenChange={(open) => {
          if (!open) workbench.closeOverlay();
        }}
      >
        <SheetContent
          side="right"
          className="w-full overflow-y-auto sm:max-w-2xl"
        >
          <SheetHeader>
            <SheetTitle>
              {workbench.overlay.kind === "queue"
                ? t("queue.sheetTitle", { name: workbench.overlay.queueName })
                : t("queue.title")}
            </SheetTitle>
          </SheetHeader>
          {workbench.overlay.kind === "queue" ? (
            <div className="mt-4">
              <QueuePanel
                queueName={workbench.overlay.queueName}
                displayName={workbench.overlay.queueName}
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

      {/* Editor dialog (Edit / View) */}
      {workbench.editorOpen ? (
        <RoutineEditorDialog
          isOpen={true}
          onClose={workbench.closeEditor}
          messages={routine.steps_json ?? []}
          agentId={routine.agent}
          sessionTitle={routine.name}
          existingWorkflow={{
            id: routine.id,
            name: routine.name,
            description: routine.description ?? undefined,
            rights_mode: routine.rights_mode,
            // Domain RBAC -> editor RBAC: the legacy GraphQL schema typed
            // user ids as numbers; coerce defensively (the API returns
            // strings here and there). Roles/teams stay as strings.
            RBAC: {
              users: (routine.RBAC?.users ?? []).map((u) => ({
                id: Number(u.id),
                rights: u.rights,
              })),
              roles: (routine.RBAC?.roles ?? []).map((r) => ({
                id: String(r.id),
                rights: r.rights,
              })),
              teams: (routine.RBAC?.teams ?? []).map((tm) => ({
                id: String(tm.id),
                rights: tm.rights,
              })),
            },
            steps_json: routine.steps_json ?? undefined,
            agent: routine.agent,
          }}
          isReadOnly={workbench.editorMode === "view"}
        />
      ) : null}

      {/* Delete confirm — on success the hook router.push('/workflows'). */}
      <DeleteRoutineDialog
        routine={workbench.deleteOpen ? routine : null}
        onClose={() => workbench.setDeleteOpen(false)}
        onConfirm={async () => {
          await workbench.confirmDelete();
        }}
      />
    </PageShell>
  );
}
