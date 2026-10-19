"use client";

/**
 * "New artifact": upload a file, name its link, decide who can open it.
 *
 * Three existing APIs, no new backend: POST /s3/sign hands out a presigned
 * PUT under the caller's own prefix (the same route the Uppy uploads use),
 * the browser PUTs the bytes straight to object storage, and
 * POST /shared-artifacts turns the stored key into a share with the chosen
 * name and sharing settings.
 */

import { FileUp, X } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import { Dropzone } from "@/components/primitives/dropzone";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sharedArtifactsApi } from "@/lib/api/shared-artifacts";
import { artifactType, contentTypeFor } from "@/lib/artifacts/artifact-type";
import { slugifyShareName } from "@/lib/artifacts/share-name";
import { extractS3KeyFromUrl } from "@/lib/s3/extract-key";

import { EMPTY_RBAC, SharingForm, sharingPayload, type SharingValue } from "./sharing-form";

export interface CreateArtifactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (name: string) => void;
}

type Phase = { kind: "idle" } | { kind: "uploading"; percent: number } | { kind: "publishing" };

const INITIAL_SHARING: SharingValue = { authMode: "regular", password: "", expiry: "never", rightsMode: "private", rbac: EMPTY_RBAC };

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function CreateArtifactDialog({ open, onOpenChange, onCreated }: CreateArtifactDialogProps) {
  const t = useTranslations("artifacts");
  const [file, setFile] = React.useState<File | null>(null);
  const [name, setName] = React.useState("");
  const [sharing, setSharing] = React.useState<SharingValue>(INITIAL_SHARING);
  const [phase, setPhase] = React.useState<Phase>({ kind: "idle" });

  React.useEffect(() => {
    if (!open) return;
    setFile(null);
    setName("");
    setSharing(INITIAL_SHARING);
    setPhase({ kind: "idle" });
  }, [open]);

  const pick = (files: File[]) => {
    const f = files[0];
    if (!f) return;
    setFile(f);
    setName((current) => (current.trim() ? current : slugifyShareName(f.name)));
  };

  const slug = slugifyShareName(name);
  const busy = phase.kind !== "idle";
  const needsPassword = sharing.authMode === "password" && !sharing.password;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const type = file ? artifactType(file.name, file.type) : null;

  const publish = async () => {
    if (!file || !slug || busy) return;
    const contentType = contentTypeFor(file.name, file.type);
    let s3key: string;
    try {
      setPhase({ kind: "uploading", percent: 0 });
      const signed = await sharedArtifactsApi.signUpload(file.name, contentType);
      await sharedArtifactsApi.putToSignedUrl(signed.url, file, contentType, (percent) => setPhase({ kind: "uploading", percent }));
      s3key = extractS3KeyFromUrl(signed.url);
    } catch (err) {
      setPhase({ kind: "idle" });
      toast.error(t("uploadFailed"), { description: err instanceof Error ? err.message : undefined });
      return;
    }
    try {
      setPhase({ kind: "publishing" });
      const created = await sharedArtifactsApi.create({ s3key, name: slug, content_type: contentType, expires_at: null, ...sharingPayload(sharing) });
      toast.success(t("published", { name: created.name }));
      onCreated(created.name);
      onOpenChange(false);
    } catch (err) {
      // the bytes are stored; only the share row failed (e.g. 409 name taken) — keep the dialog open
      setPhase({ kind: "idle" });
      toast.error(t("publishFailed"), { description: err instanceof Error ? err.message : undefined });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("createTitle")}</DialogTitle>
          <DialogDescription>{t("createDescription")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!file ? (
            <Dropzone onFiles={pick} label={t("dropLabel")} hint={t("dropHint")} disabled={busy} />
          ) : (
            <div className="flex items-center gap-3 rounded-md border px-3 py-2">
              <FileUp aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatSize(file.size)}
                  {type ? ` · ${t(type.labelKey)}` : ""}
                </p>
              </div>
              <Button type="button" variant="ghost" size="icon" aria-label={t("changeFile")} title={t("changeFile")} disabled={busy} onClick={() => setFile(null)}>
                <X aria-hidden="true" className="size-4" />
              </Button>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="artifact-create-name">{t("renameLabel")}</Label>
            <Input id="artifact-create-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" spellCheck={false} disabled={busy} />
            <p className="text-xs text-muted-foreground">{t("nameHint", { url: `${origin}/artifacts/${slug || "…"}` })}</p>
          </div>

          <SharingForm value={sharing} onChange={setSharing} disabled={busy} />

          {phase.kind === "uploading" && (
            <div className="space-y-1" aria-live="polite">
              <p className="text-xs text-muted-foreground">{t("uploading", { percent: phase.percent })}</p>
              <div className="h-1.5 w-full overflow-hidden rounded bg-muted">
                <div className="h-full bg-primary transition-[width]" style={{ width: `${phase.percent}%` }} />
              </div>
            </div>
          )}
          {phase.kind === "publishing" && (
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {t("publishing")}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {t("cancel")}
          </Button>
          <Button type="button" onClick={() => void publish()} disabled={busy || !file || !slug || needsPassword}>
            {t("publish")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
