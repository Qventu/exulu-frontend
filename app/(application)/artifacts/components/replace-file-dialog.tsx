"use client";

/**
 * "Replace file": upload a new file behind an EXISTING share link.
 *
 * The list could publish a new artifact but never update one, so a revised
 * report meant a second link and a dead first one. The backend had the
 * other half all along: PATCH /shared-artifacts/:name accepts an `s3key`
 * (sharedArtifactsApi.update — "re-point the share at another object you
 * uploaded"), checking that the caller owns both the share and the new
 * object. So this is the create dialog's upload leg (POST /s3/sign → PUT
 * straight to object storage) followed by that PATCH instead of a POST.
 *
 * What stays: the name (the link), the access mode, password, expiry and
 * rights. What changes: the bytes and the content type — and with them,
 * possibly how the artifact opens (an HTML app → a PDF), which the dialog
 * says up front. The content route serves with `no-store`, so everyone who
 * has the link sees the new file on their next load.
 */

import { FileUp, X } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import { Dropzone } from "@/components/primitives/dropzone";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { sharedArtifactsApi } from "@/lib/api/shared-artifacts";
import { artifactType, contentTypeFor } from "@/lib/artifacts/artifact-type";
import { extractS3KeyFromUrl } from "@/lib/s3/extract-key";

import type { ArtifactListItem } from "../hooks";

export interface ReplaceFileDialogProps {
  /** The share to re-point; null keeps the dialog closed. */
  item: ArtifactListItem | null;
  onOpenChange: (open: boolean) => void;
  /** Called with the share name after the backend accepted the new file. */
  onReplaced: (name: string) => void;
}

type Phase =
  | { kind: "idle" }
  | { kind: "uploading"; percent: number }
  | { kind: "saving" };

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ReplaceFileDialog({
  item,
  onOpenChange,
  onReplaced,
}: ReplaceFileDialogProps) {
  const t = useTranslations("artifacts");
  const [file, setFile] = React.useState<File | null>(null);
  const [phase, setPhase] = React.useState<Phase>({ kind: "idle" });
  const open = item !== null;

  React.useEffect(() => {
    if (!open) return;
    setFile(null);
    setPhase({ kind: "idle" });
  }, [open]);

  const busy = phase.kind !== "idle";
  const nextType = file ? artifactType(file.name, file.type) : null;
  const kindChanges = !!item && !!nextType && nextType.kind !== item.type.kind;

  const replace = async () => {
    if (!item || !file || busy) return;
    const contentType = contentTypeFor(file.name, file.type);
    let s3key: string;
    try {
      setPhase({ kind: "uploading", percent: 0 });
      const signed = await sharedArtifactsApi.signUpload(
        file.name,
        contentType,
      );
      await sharedArtifactsApi.putToSignedUrl(
        signed.url,
        file,
        contentType,
        (percent) => setPhase({ kind: "uploading", percent }),
      );
      s3key = extractS3KeyFromUrl(signed.url);
    } catch (err) {
      setPhase({ kind: "idle" });
      toast.error(t("uploadFailed"), {
        description: err instanceof Error ? err.message : undefined,
      });
      return;
    }
    try {
      setPhase({ kind: "saving" });
      const result = await sharedArtifactsApi.update(item.name, {
        s3key,
        content_type: contentType,
      });
      toast.success(t("replaced", { name: result.name }));
      onReplaced(result.name);
      onOpenChange(false);
    } catch (err) {
      // the bytes are stored; only the re-point failed — keep the dialog open for a retry
      setPhase({ kind: "idle" });
      toast.error(t("replaceFailed"), {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {t("replaceTitle", { name: item?.name ?? "" })}
          </DialogTitle>
          <DialogDescription>{t("replaceDescription")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!file ? (
            <Dropzone
              onFiles={(files) => files[0] && setFile(files[0])}
              label={t("dropLabel")}
              hint={t("dropHint")}
              disabled={busy}
            />
          ) : (
            <div className="flex items-center gap-3 rounded-md border px-3 py-2">
              <FileUp
                aria-hidden="true"
                className="size-5 shrink-0 text-muted-foreground"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatSize(file.size)}
                  {nextType ? ` · ${t(nextType.labelKey)}` : ""}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t("changeFile")}
                title={t("changeFile")}
                disabled={busy}
                onClick={() => setFile(null)}
              >
                <X aria-hidden="true" className="size-4" />
              </Button>
            </div>
          )}

          {kindChanges && item && nextType ? (
            <p className="text-xs text-warning" role="note">
              {t("replaceTypeChange", {
                current: t(item.type.labelKey),
                next: t(nextType.labelKey),
              })}
            </p>
          ) : null}

          {phase.kind === "uploading" && (
            <div className="space-y-1" aria-live="polite">
              <p className="text-xs text-muted-foreground">
                {t("uploading", { percent: phase.percent })}
              </p>
              <div className="h-1.5 w-full overflow-hidden rounded bg-muted">
                <div
                  className="h-full bg-primary transition-[width]"
                  style={{ width: `${phase.percent}%` }}
                />
              </div>
            </div>
          )}
          {phase.kind === "saving" && (
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {t("replacing")}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            {t("cancel")}
          </Button>
          <Button
            type="button"
            onClick={() => void replace()}
            disabled={busy || !file}
          >
            {t("replaceSave")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
