"use client";

/**
 * RoutineWorkbench — /workflows/[id] client root.
 *
 * After the editor-dialog removal, this is the canonical edit surface for a
 * routine. Mirrors the agents EditorView shape:
 *  PageShell variant="content"
 *    RoutineHeader (PageHeader w/ breadcrumb, leading icon, agent + visibility,
 *                   Run primary + OverflowMenu Copy-ID-only)
 *    Separator
 *    grid gap-8 lg:grid-cols-[200px_1fr]
 *      SectionNav (sticky lg+, chip row <lg) wired to useScrollSpy
 *      div.min-w-0 > div.mx-auto.max-w-3xl.space-y-12 >
 *        <BasicsSection />     (id="basics")
 *        <AccessSection />     (id="access")
 *        <StepsSection />      (id="steps")  read-only preview + Sheet trigger
 *        <ScheduleSection />   (id="schedule")
 *        <RunsSection />       (id="runs")
 *        <QueueSection />      (id="queue")
 *        <DangerSection />     (id="danger") — Delete (canDelete only)
 *    SaveBar + useUnsavedChangesGuard (page-level, for Basics + Access)
 *    Subpage-local overlays (single-overlay invariant):
 *      RunRoutineDialog (Run button + Runs row "Retry")
 *      Queue Sheet (Manage queue)
 *      StepsEditorSheet (Steps section "Edit steps")
 *      DeleteRoutineDialog (Danger Zone Delete)
 *
 * STATE SEPARATION (intentional):
 * - Page-level form (editor.form): Basics + Access. Dirty triggers the
 *   page SaveBar AND useUnsavedChangesGuard.
 * - Parent-held stepsJson + Sheet-local form: Steps. Dirty triggers the
 *   Sheet's own SaveBar; closing the Sheet while dirty opens its own
 *   ConfirmDialog. The page-level dirty state is unaffected.
 * - When the Sheet saves, parent stepsJson updates so the preview reflects
 *   the saved value; subsequent page-level saves forward this value as
 *   steps_json (byte-equivalent to the killed dialog's UPDATE payload).
 *
 * SECTION ORDER: ROUTINE_SECTION_IDS is the authoritative order; the JSX
 * below MUST match it so the default activeId aligns with the first visible
 * section.
 */

import { useMutation } from "@apollo/client";
import { MessageSquare } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";

import { PageShell } from "@/components/primitives/page-shell";
import { QueuePanel } from "@/components/primitives/queue-panel";
import {
  SaveBar,
  useUnsavedChangesGuard,
} from "@/components/primitives/save-bar";
import { SectionNav } from "@/components/primitives/section-nav";
import { MobileTopbarAction } from "@/components/shell/mobile-topbar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import { DeleteRoutineDialog } from "../../components/delete-routine-dialog";
import { RunRoutineDialog } from "../../components/run-routine-dialog";
import { RUN_WORKFLOW } from "../../queries";
import { ROUTINES_EMAIL_TRIGGER_SUPPORTED } from "../../schema-flags";
import type { Routine } from "../../types";
import { useRoutineEditor, useRoutineWorkbench, useScrollSpy } from "../hooks";
import { AccessSection } from "../sections/access";
import { BasicsSection } from "../sections/basics";
import { DangerSection } from "../sections/danger";
import { QueueSection } from "../sections/queue";
import { RunsSection } from "../sections/runs";
import { ScheduleSection } from "../sections/schedule";
import { StepsSection } from "../sections/steps";
import { TriggersSection } from "../sections/triggers";
import { RoutineHeader } from "./routine-header";
import { StepsEditorSheet } from "./steps-editor-sheet";

export const ROUTINE_SECTION_IDS = [
  "basics",
  "access",
  "steps",
  "schedule",
  "triggers",
  "runs",
  "queue",
  "danger",
] as const;
export type RoutineSectionId = (typeof ROUTINE_SECTION_IDS)[number];
export const DEFAULT_ROUTINE_SECTION: RoutineSectionId = "basics";

export interface RoutineWorkbenchProps {
  routine: Routine;
}

export function RoutineWorkbench({ routine }: RoutineWorkbenchProps) {
  const t = useTranslations("routines");
  const workbench = useRoutineWorkbench(routine);
  const editor = useRoutineEditor(routine);

  // Surface the Steps Sheet's local dirty state up so the page-level guard
  // catches cross-page navigation while step edits are pending (Link clicks
  // would otherwise be discarded silently — the Sheet's own ConfirmDialog
  // only guards Sheet close).
  const [stepsSheetDirty, setStepsSheetDirty] = React.useState(false);
  const { guardDialog } = useUnsavedChangesGuard(
    editor.dirty || stepsSheetDirty,
  );

  // Filter out the Danger section from the SectionNav when the user has no
  // delete access — the section itself returns null, so leaving the nav id
  // in would link to a non-existent anchor.
  const sectionIds = React.useMemo(
    () =>
      ROUTINE_SECTION_IDS.filter(
        (id) =>
          (id !== "danger" || workbench.access.canDelete) &&
          (id !== "triggers" || ROUTINES_EMAIL_TRIGGER_SUPPORTED),
      ),
    [workbench.access.canDelete],
  );

  const activeId = useScrollSpy(sectionIds as unknown as string[]);

  // Subpage-local non-interactive retry for the Queue panel (workflows.md
  // ladder #26 / #33). Inline mutation avoids the dialog-overwrite bug.
  const [runWorkflowMutation] = useMutation(RUN_WORKFLOW);

  const sections = React.useMemo(
    () =>
      sectionIds.map((id) => ({
        id,
        label: t(`editor.sections.${id}` as const),
      })),
    [t, sectionIds],
  );

  const handleSelect = React.useCallback((id: string) => {
    const target = document.getElementById(id);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    target.setAttribute("tabindex", "-1");
    (target as HTMLElement).focus({ preventScroll: true });
  }, []);

  const sectionProps = { routine, editor, workbench };

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
        displayName={editor.lastSaved.name || routine.name}
        onRun={() => workbench.openRun()}
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
            <BasicsSection {...sectionProps} />
            <AccessSection {...sectionProps} />
            <StepsSection
              routine={routine}
              stepsJson={editor.stepsJson}
              canWrite={workbench.access.canWrite}
              onOpenSheet={workbench.openStepsSheet}
            />
            <ScheduleSection routine={routine} access={workbench.access} />
            <TriggersSection routine={routine} access={workbench.access} />
            <RunsSection
              routine={routine}
              onRetry={(prefill) => workbench.openRun(prefill)}
            />
            <QueueSection
              queueName={workbench.queueName}
              onManageQueue={workbench.openQueue}
            />
            <DangerSection {...sectionProps} />
          </div>
        </div>
      </div>

      {/* Page-level SaveBar — Basics + Access. Steps Sheet runs its own
          independent SaveBar inside the sheet panel. */}
      <SaveBar
        dirty={editor.dirty}
        saving={editor.saving}
        onSave={() => editor.save()}
        onDiscard={() => editor.discard()}
        summary={t("editor.unsavedChanges")}
      />

      {guardDialog}

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

      {/* Steps editor Sheet (replaces the killed editor dialog Edit/View). */}
      <StepsEditorSheet
        open={workbench.stepsSheetOpen}
        onOpenChange={(open) =>
          open ? workbench.openStepsSheet() : workbench.closeStepsSheet()
        }
        routine={routine}
        canWrite={workbench.access.canWrite}
        initialStepsJson={editor.stepsJson}
        // Use the actually-last-saved agent (NOT the SSR `routine.agent`),
        // so a just-saved Basics agent change isn't reverted by the Sheet.
        lastSavedAgent={editor.lastSaved.agent}
        onSaved={(nextSteps) => editor.setStepsJson(nextSteps)}
        onDirtyChange={setStepsSheetDirty}
      />

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
