"use client";

/**
 * VersionRestoreModal — apply an older prompt version, snapshotting the
 * current state into history first (work item 2.9; prompts.md inventory
 * item 43).
 *
 * Fixes prompts.md M9: the legacy modal wrote `changed_by: prompt.created_by`,
 * mis-attributing every restore to the prompt's original author. The acting
 * user id is now a required prop (`actingUserId`) and the snapshot uses
 * `lib/prompts/build-version-history.buildRestoreHistory` for the same
 * 50-cap rule the editor uses.
 *
 * Behavior preserved otherwise: amber warning explaining the rollback,
 * change preview, optional restore note ("Restored from vN" default).
 */

import { useMutation } from "@apollo/client";
import { AlertTriangle, ArrowRight, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { buildRestoreHistory } from "@/lib/prompts";
import type { PromptLibrary, PromptVersion } from "@/types/models/prompt-library";

import { UPDATE_PROMPT_INDEX } from "../queries";

interface VersionRestoreModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prompt: PromptLibrary;
  version: PromptVersion;
  /** Acting user id (fixes M9 — must NOT be prompt.created_by). */
  actingUserId: string;
  onRestore: () => void;
}

export function VersionRestoreModal({
  open,
  onOpenChange,
  prompt,
  version,
  actingUserId,
  onRestore,
}: VersionRestoreModalProps) {
  const t = useTranslations("prompts");
  const tCommon = useTranslations("common");

  const [restoreMessage, setRestoreMessage] = useState(
    t("restore.defaultMessage", { version: version.version }),
  );
  const [isRestoring, setIsRestoring] = useState(false);
  const [updatePrompt] = useMutation(UPDATE_PROMPT_INDEX);

  const contentWillChange = version.content !== prompt.content;
  const nameWillChange = !!version.name && version.name !== prompt.name;
  const descriptionWillChange =
    (version.description ?? "") !== (prompt.description ?? "");
  const tagsWillChange =
    JSON.stringify(version.tags ?? []) !== JSON.stringify(prompt.tags ?? []);
  const hasChanges =
    contentWillChange ||
    nameWillChange ||
    descriptionWillChange ||
    tagsWillChange;

  const handleRestore = async () => {
    if (!hasChanges) {
      toast.info(t("restore.noChangesTitle"), {
        description: t("restore.noChangesDescription"),
      });
      return;
    }

    setIsRestoring(true);
    try {
      const finalHistory = buildRestoreHistory({
        prompt,
        changedBy: actingUserId,
        changeMessage: restoreMessage,
      });

      await updatePrompt({
        variables: {
          id: prompt.id,
          content: version.content,
          name: version.name ?? prompt.name,
          description: version.description ?? prompt.description,
          tags: version.tags ?? prompt.tags,
          history: finalHistory,
        },
      });

      toast.success(t("restore.successTitle"), {
        description: t("restore.successDescription", {
          version: version.version,
        }),
      });

      onRestore();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to restore version:", error);
      toast.error(t("restore.failTitle"), {
        description: t("restore.failDescription"),
      });
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw aria-hidden="true" className="size-5 text-primary" />
            {t("restore.title", { version: version.version })}
          </DialogTitle>
          <DialogDescription>
            {t("restore.description", { version: version.version })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div
            role="status"
            className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/20 dark:bg-amber-950/50 dark:text-amber-300"
          >
            <AlertTriangle
              aria-hidden="true"
              className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400"
            />
            <div className="space-y-1">
              <p className="font-semibold">
                {t("restore.warningTitle")}
              </p>
              <p className="text-xs">{t("restore.warningDescription")}</p>
            </div>
          </div>

          {hasChanges ? (
            <div className="space-y-3 rounded-md border bg-muted/30 p-4">
              <p className="text-sm font-semibold">
                {t("restore.changesPreview")}
              </p>
              {contentWillChange ? (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    {t("editor.contentLabel")}
                  </Label>
                  <div className="rounded border bg-background p-2">
                    <p className="line-clamp-3 font-mono text-xs text-muted-foreground">
                      {version.content}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {t("restore.charCount", {
                      count: version.content.length,
                    })}
                  </Badge>
                </div>
              ) : null}

              {nameWillChange ? (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    {tCommon("name")}
                  </Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground line-through">
                      {prompt.name}
                    </span>
                    <ArrowRight
                      aria-hidden="true"
                      className="size-3 text-muted-foreground"
                    />
                    <span className="text-sm font-medium">
                      {version.name}
                    </span>
                  </div>
                </div>
              ) : null}

              {descriptionWillChange ? (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    {tCommon("description")}
                  </Label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground line-through">
                      {prompt.description ?? t("diff.none")}
                    </span>
                    <ArrowRight
                      aria-hidden="true"
                      className="size-3 text-muted-foreground"
                    />
                    <span className="text-xs">
                      {version.description ?? t("diff.none")}
                    </span>
                  </div>
                </div>
              ) : null}

              {tagsWillChange ? (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    {t("editor.tagsLabel")}
                  </Label>
                  <div className="flex flex-wrap items-center gap-2">
                    {prompt.tags?.map((tag) => (
                      <Badge
                        key={`p-${tag}`}
                        variant="outline"
                        className="text-xs line-through"
                      >
                        {tag}
                      </Badge>
                    ))}
                    <ArrowRight
                      aria-hidden="true"
                      className="size-3 text-muted-foreground"
                    />
                    {version.tags?.map((tag) => (
                      <Badge
                        key={`v-${tag}`}
                        variant="secondary"
                        className="text-xs"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label
              htmlFor="restore-message"
              className="text-sm font-semibold"
            >
              {t("restore.noteLabel")}
            </Label>
            <Textarea
              id="restore-message"
              value={restoreMessage}
              onChange={(event) => setRestoreMessage(event.target.value)}
              placeholder={t("restore.notePlaceholder")}
              className="min-h-[80px] text-sm"
            />
            <p className="text-xs text-muted-foreground">
              {t("restore.noteHint")}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isRestoring}
          >
            {tCommon("cancel")}
          </Button>
          <Button
            onClick={() => void handleRestore()}
            disabled={isRestoring || !hasChanges}
            aria-busy={isRestoring}
          >
            {isRestoring ? (
              <>
                <span
                  aria-hidden="true"
                  className="mr-2 size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                />
                {t("restore.restoring")}
              </>
            ) : (
              <>
                <RotateCcw
                  aria-hidden="true"
                  className="mr-2 size-4"
                />
                {t("restore.confirm")}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
