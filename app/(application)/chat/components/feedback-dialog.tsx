"use client";

/**
 * Thumbs feedback dialog (chat.md items 57/58).
 *
 * Route-local replacement for the feedback Dialog + ReferencedSourceRow +
 * extractReferencedItems block of the chat.tsx monolith (chat.tsx:1413–1706):
 * - free-text description + CREATE_FEEDBACK (chat/queries.ts copy);
 * - on negative feedback, the sources cited in the rated answer are listed;
 * - per-source "Deactivate" is rendered ONLY for users passing the interim
 *   knowledge-curation gate (`can(user, { area: "agents", level: "write" })`,
 *   provided by the mount as `canDeactivateSources` — fixes U3);
 * - deactivation confirms via the inline two-step strip INSIDE this dialog
 *   ("Archives {item} globally for every user." + Confirm deactivate /
 *   Cancel) — never a stacked ConfirmDialog (anti-pattern #3);
 * - the citation-extraction regex is moved VERBATIM (risk 2 black box).
 */

import { useMutation } from "@apollo/client";
import type { UIMessage } from "ai";
import { AlertTriangle, FileText, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useContext, useMemo, useState } from "react";
import { toast } from "sonner";

import { UserContext } from "@/app/(application)/authenticated";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

import { CREATE_FEEDBACK, UPDATE_ITEM } from "../queries";

export interface ReferencedItem {
  itemId: string;
  itemName: string;
  context: string;
}

export interface FeedbackTarget {
  sessionId: string;
  agentId: string;
  score: 0 | 1;
  referencedItems: ReferencedItem[];
}

export interface FeedbackDialogProps {
  /** null = closed. */
  target: FeedbackTarget | null;
  onOpenChange: (open: boolean) => void;
  /**
   * `can(user, { area: "agents", level: "write" })` from lib/rights — interim
   * knowledge-curation gate (FLAGGED backend dependency: swaps to a
   * `role.knowledge` predicate when that key lands). Gates the per-source
   * Deactivate rows (item 58 / U3 fix).
   */
  canDeactivateSources: boolean;
}

// Pull cited sources out of an assistant message. Citations live in the raw
// text as `{item_name: …, item_id: …, context: …, …}` blobs (same shape the
// MessageRenderer transforms into <cite-marker-knowledge-source> elements).
// We need item_id + context to drive the per-context UPDATE_ITEM mutation,
// so anything missing either is skipped. Deduped by `${context}/${itemId}`.
// NOTE: moved verbatim from chat.tsx — the citation regex is a black box
// this pass (chat.md risk 2).
export function extractReferencedItems(message: UIMessage): ReferencedItem[] {
  const seen = new Map<string, ReferencedItem>();
  const blobRegex = /\{[^}]*?item_name\s*:\s*[^,}]+[^}]*?\}/g;
  const fieldRegex = /(\w+)\s*:\s*([^,}]+?)(?:,|$)/g;

  for (const part of message.parts || []) {
    if (part.type !== 'text') continue;
    const text = (part as any).text as string;
    if (!text) continue;
    const blobs = text.match(blobRegex);
    if (!blobs) continue;
    for (const blob of blobs) {
      const inner = blob.slice(1, -1);
      const fields: Record<string, string> = {};
      let m: RegExpExecArray | null;
      fieldRegex.lastIndex = 0;
      while ((m = fieldRegex.exec(inner)) !== null) {
        fields[m[1].trim()] = m[2].trim();
      }
      const itemId = fields.item_id;
      const itemName = fields.item_name;
      const context = fields.context;
      if (!itemId || !itemName || !context) continue;
      const key = `${context}/${itemId}`;
      if (seen.has(key)) continue;
      seen.set(key, {
        itemId,
        itemName: itemName.split('/').pop() || itemName,
        context,
      });
    }
  }

  return Array.from(seen.values());
}

export function FeedbackDialog({
  target,
  onOpenChange,
  canDeactivateSources,
}: FeedbackDialogProps) {
  const t = useTranslations("chat");
  const tCommon = useTranslations("common");
  const { user } = useContext(UserContext);

  const [description, setDescription] = useState("");
  const [createFeedback, createFeedbackResult] = useMutation(CREATE_FEEDBACK);

  // Fresh text every time the dialog opens for a new target (adjust-during-
  // render pattern — no effect, no cascading re-render).
  const [lastTarget, setLastTarget] = useState<FeedbackTarget | null>(target);
  if (target !== lastTarget) {
    setLastTarget(target);
    if (target) setDescription("");
  }

  const handleSubmit = async () => {
    if (!target) return;
    try {
      await createFeedback({
        variables: {
          input: {
            session: target.sessionId,
            score: target.score,
            agent: target.agentId,
            description,
            user: user.id,
          },
        },
      });
      toast.success(t("feedbackDialog.submitted"), {
        description: t("feedbackDialog.submittedDescription"),
      });
      onOpenChange(false);
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("Failed to submit feedback:", error);
      }
      toast.error(t("feedbackDialog.submitFailed"), {
        description:
          error instanceof Error
            ? error.message
            : t("feedbackDialog.submitFailedDescription"),
      });
    }
  };

  const positive = target?.score === 1;
  const showSources =
    target?.score === 0 && target.referencedItems.length > 0;

  return (
    <Dialog
      open={!!target}
      onOpenChange={(open) => {
        if (createFeedbackResult.loading) return;
        onOpenChange(open);
      }}
    >
      <DialogContent className="flex max-h-[85dvh] flex-col gap-4 overflow-hidden">
        <DialogHeader>
          <DialogTitle>
            {positive
              ? t("feedbackDialog.titlePositive")
              : t("feedbackDialog.titleNegative")}
          </DialogTitle>
          <DialogDescription>
            {positive
              ? t("feedbackDialog.descriptionPositive")
              : t("feedbackDialog.descriptionNegative")}
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-1 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1">
          <Textarea
            placeholder={t("feedbackDialog.placeholder")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="min-h-[100px] text-base md:text-sm"
            aria-label={t("feedbackDialog.placeholder")}
          />

          {showSources && target && (
            <div className="space-y-3 border-t pt-4">
              <div>
                <p className="text-sm font-medium">
                  {t("feedbackDialog.sourcesTitle")}
                </p>
                {canDeactivateSources && (
                  <div className="mt-1.5 flex items-start gap-2 text-xs text-muted-foreground">
                    <AlertTriangle
                      className="mt-0.5 size-3.5 shrink-0 text-warning"
                      aria-hidden="true"
                    />
                    <span>{t("feedbackDialog.deactivateHint")}</span>
                  </div>
                )}
              </div>
              <div className="max-h-56 space-y-1.5 overflow-y-auto">
                {target.referencedItems.map((item) => (
                  <ReferencedSourceRow
                    key={`${item.context}/${item.itemId}`}
                    itemId={item.itemId}
                    itemName={item.itemName}
                    context={item.context}
                    canDeactivate={canDeactivateSources}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            className="h-11 sm:h-10"
            disabled={createFeedbackResult.loading}
            onClick={() => onOpenChange(false)}
          >
            {tCommon("cancel")}
          </Button>
          <Button
            className="h-11 sm:h-10"
            onClick={handleSubmit}
            disabled={createFeedbackResult.loading || !description.trim()}
          >
            {createFeedbackResult.loading && (
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
            )}
            {createFeedbackResult.loading
              ? t("feedbackDialog.submitting")
              : t("feedbackDialog.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * One cited source. The destructive "Deactivate" path uses the documented
 * in-dialog two-step inline confirm (codebase-structure §2.2 sidebar): the
 * row's Deactivate button swaps in a confirm strip — one overlay at a time,
 * never modal-on-modal.
 */
function ReferencedSourceRow({
  itemId,
  itemName,
  context,
  canDeactivate,
}: ReferencedItem & { canDeactivate: boolean }) {
  const t = useTranslations("chat");
  const tCommon = useTranslations("common");
  const [phase, setPhase] = useState<"idle" | "confirming" | "deactivated">(
    "idle",
  );
  const mutation = useMemo(() => UPDATE_ITEM(context), [context]);
  const [updateItem, { loading }] = useMutation(mutation);

  const handleConfirmDeactivate = async () => {
    try {
      await updateItem({ variables: { id: itemId, input: { archived: true } } });
      setPhase("deactivated");
      toast.success(t("feedbackDialog.deactivatedToast"), {
        description: t("feedbackDialog.deactivatedToastDescription", {
          item: itemName,
        }),
      });
    } catch (error) {
      toast.error(t("feedbackDialog.deactivateFailed"), {
        description:
          error instanceof Error
            ? error.message
            : t("feedbackDialog.deactivateFailedDescription"),
      });
    }
  };

  return (
    <div className="rounded-md border border-border">
      <div className="flex items-center justify-between gap-3 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <FileText
            className="size-3.5 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <div className="truncate text-sm">{itemName}</div>
            <div className="truncate text-xs capitalize text-muted-foreground">
              {context.replaceAll("_", " ")}
            </div>
          </div>
        </div>
        {canDeactivate && phase === "idle" && (
          <Button
            variant="outline"
            size="sm"
            className="h-11 shrink-0 text-destructive hover:text-destructive sm:h-8"
            onClick={() => setPhase("confirming")}
          >
            {t("feedbackDialog.deactivate")}
          </Button>
        )}
        {phase === "deactivated" && (
          <span className="shrink-0 text-xs text-muted-foreground">
            {t("feedbackDialog.deactivated")}
          </span>
        )}
      </div>
      {phase === "confirming" && (
        <div
          role="alert"
          className="flex flex-col gap-2 border-t border-border bg-destructive/5 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-xs text-destructive">
            {t("feedbackDialog.deactivateWarning", { item: itemName })}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-11 sm:h-8"
              disabled={loading}
              onClick={() => setPhase("idle")}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="h-11 sm:h-8"
              disabled={loading}
              onClick={handleConfirmDeactivate}
            >
              {loading && (
                <Loader2
                  className="mr-1.5 size-3.5 animate-spin"
                  aria-hidden="true"
                />
              )}
              {t("feedbackDialog.confirmDeactivate")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
