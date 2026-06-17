"use client";

/**
 * StepsEditorSheet — wide right-side Sheet that hosts the full conversation
 * editor for a routine's steps_json. Replaces the killed RoutineEditorDialog's
 * Steps tab.
 *
 * Why a Sheet over inline: the Conversation primitive + composer + UppyDashboard
 * need horizontal room the workbench's `max-w-3xl` column cannot give them.
 * The Sheet owns its OWN react-hook-form scoped to { stepsJson } and its own
 * SaveBar — the page-level Basics/Access form is untouched while this is open.
 *
 * Save:
 *  - Sends ONLY `{ id, agent: routine.agent (last-saved), steps_json }` —
 *    sending agent every update preserves UX #8 (agent always required); the
 *    last-saved value is used (NOT the page-level form's pending agent) so an
 *    unconfirmed Basics edit cannot leak through this save.
 *  - Mirrors the killed dialog's payload shape byte-equivalent except for the
 *    fields it doesn't need (name/description/RBAC stay on the page form).
 *  - On success: updates parent stepsJson via onSaved, then onClose.
 *
 * Close-while-dirty:
 *  - Embedded ConfirmDialog ("Discard step changes?") gates the Sheet's
 *    open/close transition when the local form is dirty. Independent of the
 *    page-level useUnsavedChangesGuard.
 */

import { useMutation } from "@apollo/client";
import type { FileUIPart, UIMessage } from "ai";
import { AlertCircle, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import { Conversation, ConversationContent } from "@/components/ai-elements/conversation";
import { MessageRenderer } from "@/components/message-renderer";
import { ConfirmDialog } from "@/components/primitives/confirm-dialog";
import UppyDashboard, {
  FileItem,
  getPresignedUrl,
} from "@/components/primitives/file-picker";
import { SaveBar } from "@/components/primitives/save-bar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";

import {
  GET_WORKFLOW_TEMPLATES,
  UPDATE_WORKFLOW_TEMPLATE,
} from "../../queries";
import type { Routine } from "../../types";

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const createPlaceholderMessage = (): UIMessage => ({
  id: newId(),
  role: "assistant",
  metadata: { type: "placeholder" },
  parts: [
    {
      type: "text",
      text: "Placeholder — the agent's generated response will appear here when the routine runs.",
    },
  ],
});

export interface StepsEditorSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  routine: Routine;
  canWrite: boolean;
  /** Parent-held current steps_json value (seeds the sheet form on open). */
  initialStepsJson: UIMessage[];
  /**
   * The actually-last-saved agent id — NOT the SSR `routine.agent`. The page-
   * level Basics save updates this via parent state when an agent change is
   * saved, so the Sheet's save sends the freshest value and cannot revert a
   * just-saved Basics change. Required per UX #8 — the Sheet refuses to save
   * if this is null/empty (mirrors the page-level zod `agent.min(1)` guard).
   */
  lastSavedAgent: string | null | undefined;
  /** Called on a successful save; parent should update its stepsJson state. */
  onSaved: (nextSteps: UIMessage[]) => void;
  /**
   * Surfaces the Sheet-local dirty state to the parent so the page-level
   * useUnsavedChangesGuard can intercept cross-page navigation while the
   * Sheet has unsaved edits (the Sheet's own ConfirmDialog only guards Sheet
   * close, not full-page navigation).
   */
  onDirtyChange?: (dirty: boolean) => void;
}

export function StepsEditorSheet({
  open,
  onOpenChange,
  routine,
  canWrite,
  initialStepsJson,
  lastSavedAgent,
  onSaved,
  onDirtyChange,
}: StepsEditorSheetProps) {
  const t = useTranslations("routines");
  const tCommon = useTranslations("common");

  // ---- Sheet-local state -------------------------------------------------

  // We keep steps in a useState (NOT RHF) because UIMessagePart's typing is
  // intentionally loose here (matches the killed dialog's `any[]` convention)
  // — and our dirty check only needs a JSON-string snapshot.
  const [stepsJson, setStepsJson] = React.useState<UIMessage[]>(initialStepsJson);
  const initialSnapshot = React.useRef<string>(JSON.stringify(initialStepsJson));

  // Composer state.
  const [currentInput, setCurrentInput] = React.useState("");
  const [currentFiles, setCurrentFiles] = React.useState<string[] | null>(null);
  const [currentFileParts, setCurrentFileParts] = React.useState<FileUIPart[]>(
    [],
  );

  // Reset state whenever the sheet (re-)opens. This is the parity moment with
  // the killed dialog's re-seed effect: `key=open` on the Sheet alone is not
  // enough because the SheetContent is portalled and React keeps the subtree
  // mounted briefly during close-animation.
  React.useEffect(() => {
    if (!open) return;
    setStepsJson(initialStepsJson);
    initialSnapshot.current = JSON.stringify(initialStepsJson);
    setCurrentInput("");
    setCurrentFiles(null);
    setCurrentFileParts([]);
  }, [open, initialStepsJson]);

  // BUG FIX parity (UX #6): convert s3 keys -> FileUIPart[] so they attach.
  React.useEffect(() => {
    if (!currentFiles || currentFiles.length === 0) {
      setCurrentFileParts([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const parts = await Promise.all(
        currentFiles.map(async (key) => ({
          type: "file" as const,
          mediaType: key.split(".").pop() ?? "",
          filename: key,
          url: await getPresignedUrl(key),
        })),
      );
      if (!cancelled) setCurrentFileParts(parts);
    })();
    return () => {
      cancelled = true;
    };
  }, [currentFiles]);

  // Dirty: JSON-string snapshot. Mirrors the page-level pattern.
  const dirty = JSON.stringify(stepsJson) !== initialSnapshot.current;

  // Surface dirty to parent so the page-level useUnsavedChangesGuard intercepts
  // cross-page navigation while step edits are pending. The Sheet's local
  // ConfirmDialog only guards Sheet-close; a Link click would otherwise discard
  // silently. Reset to false on unmount/close so a stale `true` cannot leak.
  React.useEffect(() => {
    if (!onDirtyChange) return;
    onDirtyChange(open && dirty);
    return () => {
      onDirtyChange(false);
    };
  }, [dirty, open, onDirtyChange]);

  const [updateMutate, updateState] = useMutation(UPDATE_WORKFLOW_TEMPLATE, {
    refetchQueries: [GET_WORKFLOW_TEMPLATES, "GetWorkflowTemplates"],
  });

  // ---- Add-message handler (mirrors dialog) ------------------------------

  const handleAddMessage = () => {
    if (!currentInput.trim() && currentFileParts.length === 0) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parts: any[] = [];
    if (currentInput.trim()) {
      parts.push({ type: "text", text: currentInput.trim() });
    }
    if (currentFileParts.length > 0) {
      parts.push(...currentFileParts);
    }

    const newMessage: UIMessage = {
      id: newId(),
      role: "user",
      parts,
    };

    setStepsJson([...stepsJson, newMessage, createPlaceholderMessage()]);
    setCurrentInput("");
    setCurrentFiles(null);
    setCurrentFileParts([]);
  };

  // ---- Save / Discard ----------------------------------------------------

  const handleSave = async () => {
    // UX #8: agent is always required. Block here so the partial
    // UPDATE_WORKFLOW_TEMPLATE (where `$agent: String` is nullable) cannot
    // accidentally persist `agent: null`. The page-level form's zod guard
    // covers the Basics path; this is the symmetric guard for the Sheet.
    if (!lastSavedAgent) {
      toast.error(t("editor.toast.agentRequired"));
      return;
    }
    try {
      await updateMutate({
        variables: {
          id: routine.id,
          // Agent: actually-last-saved value (parent-held), NOT the SSR
          // `routine.agent` (which never updates after the first server fetch).
          agent: lastSavedAgent,
          steps_json: stepsJson,
        },
      });
      toast.success(t("editor.toast.updated", { name: routine.name }));
      initialSnapshot.current = JSON.stringify(stepsJson);
      onSaved(stepsJson);
      onOpenChange(false);
    } catch (err) {
      toast.error(t("editor.toast.saveFailed"), {
        description: (err as Error).message,
      });
    }
  };

  const handleDiscard = () => {
    setStepsJson(initialStepsJson);
    initialSnapshot.current = JSON.stringify(initialStepsJson);
    setCurrentInput("");
    setCurrentFiles(null);
    setCurrentFileParts([]);
  };

  // ---- Close-while-dirty intercept --------------------------------------

  const [discardConfirmOpen, setDiscardConfirmOpen] = React.useState(false);

  const handleOpenChange = (next: boolean) => {
    if (!next && dirty) {
      setDiscardConfirmOpen(true);
      return;
    }
    onOpenChange(next);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl"
        >
          <SheetHeader className="border-b px-6 py-4">
            <SheetTitle>
              {canWrite
                ? t("steps.sheetTitle.edit")
                : t("steps.sheetTitle.view")}
            </SheetTitle>
            <SheetDescription>
              {canWrite
                ? t("steps.sheetDescription.edit")
                : t("steps.sheetDescription.view")}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="space-y-4">
              {stepsJson.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-12 text-center">
                  <h4 className="text-sm font-medium">
                    {t("editor.steps.emptyTitle")}
                  </h4>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("editor.steps.emptyDescription")}
                  </p>
                </div>
              ) : (
                /* @ts-ignore */
                <Conversation className="rounded-lg border bg-muted/30">
                  {/* @ts-ignore */}
                  <ConversationContent className="px-4 py-4">
                    <MessageRenderer
                      messages={stepsJson}
                      config={{
                        marginTopFirstMessage: "mt-0",
                        customAssistantClassnames:
                          "px-4 py-4 border-l-2 border-primary/30",
                      }}
                      onUpdate={(next: UIMessage[]) => setStepsJson(next)}
                      status="ready"
                      showActions={true}
                      showEdit={canWrite}
                      showRemove={canWrite}
                      showTokens={false}
                      writeAccess={canWrite}
                    />
                  </ConversationContent>
                </Conversation>
              )}

              {canWrite ? (
                <div className="space-y-3 pt-2">
                  <Label htmlFor="step-input" className="text-sm font-medium">
                    {t("editor.steps.addMessage")}
                  </Label>
                  <Textarea
                    id="step-input"
                    placeholder={t("editor.steps.placeholder")}
                    value={currentInput}
                    onChange={(e) => setCurrentInput(e.target.value)}
                    disabled={updateState.loading}
                    rows={2}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleAddMessage();
                      }
                    }}
                  />

                  <div className="flex items-center gap-2">
                    <UppyDashboard
                      id="routine-step-files-sheet"
                      selectionLimit={10}
                      allowedFileTypes={[
                        ".png",
                        ".jpg",
                        ".jpeg",
                        ".gif",
                        ".webp",
                        ".pdf",
                        ".docx",
                        ".xlsx",
                        ".xls",
                        ".csv",
                        ".pptx",
                        ".ppt",
                        ".mp3",
                        ".wav",
                        ".m4a",
                        ".mp4",
                        ".mpeg",
                      ]}
                      dependencies={[]}
                      onConfirm={(items) => setCurrentFiles(items)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleAddMessage}
                      disabled={
                        updateState.loading ||
                        (!currentInput.trim() && currentFileParts.length === 0)
                      }
                      className="ml-auto"
                    >
                      <Plus aria-hidden="true" className="mr-2 size-4" />
                      {t("editor.steps.add")}
                    </Button>
                  </div>

                  {currentFiles && currentFiles.length > 0 ? (
                    <>
                      <div className="grid grid-cols-3 gap-2">
                        {currentFiles.map((item) => (
                          <FileItem
                            key={item}
                            s3Key={item}
                            disabled={true}
                            active={false}
                            onRemove={() =>
                              setCurrentFiles(
                                currentFiles.filter((i) => i !== item),
                              )
                            }
                          />
                        ))}
                      </div>
                      <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3">
                        <AlertCircle
                          aria-hidden="true"
                          className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400"
                        />
                        <p className="text-xs text-amber-900 dark:text-amber-200">
                          {t("editor.steps.fileTypeWarning")}
                        </p>
                      </div>
                    </>
                  ) : null}

                  <p className="text-xs text-muted-foreground">
                    {t("editor.steps.hint")}
                  </p>
                </div>
              ) : null}
            </div>
          </div>

          {/* Scoped footer: a baseline Close button is always available, and a
              SaveBar mounts on top of it when the local form is dirty. The
              SaveBar primitive renders null when !dirty so the two never
              double-stack visually. View-mode shows only the Close button.
              IMPORTANT: this Close button routes through `handleOpenChange`
              (NOT `onOpenChange` directly) so dirty state opens the discard
              ConfirmDialog — same gate as Escape/outside-click. */}
          <div className="border-t bg-background">
            <div className="flex justify-end px-6 py-3">
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                {tCommon("close")}
              </Button>
            </div>
            {canWrite ? (
              <SaveBar
                dirty={dirty}
                saving={updateState.loading}
                onSave={handleSave}
                onDiscard={handleDiscard}
                summary={t("steps.sheetUnsavedChanges")}
              />
            ) : null}
          </div>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={discardConfirmOpen}
        onOpenChange={setDiscardConfirmOpen}
        title={t("steps.discardTitle")}
        description={t("steps.discardDescription")}
        variant="default"
        confirmLabel={tCommon("discard")}
        onConfirm={async () => {
          handleDiscard();
          onOpenChange(false);
        }}
      />

    </>
  );
}
