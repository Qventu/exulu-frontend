"use client";

import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sharedArtifactsApi } from "@/lib/api/shared-artifacts";
import { slugifyShareName } from "@/lib/artifacts/share-name";

export interface RenameArtifactDialogProps {
  name: string | null;
  onOpenChange: (open: boolean) => void;
  /** Called with the old and the new share name after the backend accepted it. */
  onRenamed: (from: string, to: string) => void;
}

/** Renames a share. The name is the share link, so the dialog shows the slug the link will carry. */
export function RenameArtifactDialog({ name, onOpenChange, onRenamed }: RenameArtifactDialogProps) {
  const t = useTranslations("artifacts");
  const [value, setValue] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const open = name !== null;

  React.useEffect(() => {
    if (name !== null) setValue(name);
  }, [name]);

  const slug = slugifyShareName(value);
  const unchanged = !name || slug === name;
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const save = async () => {
    if (!name || !slug || unchanged) return;
    setSaving(true);
    try {
      const result = await sharedArtifactsApi.update(name, { name: slug });
      toast.success(t("renamed", { name: result.name }));
      onRenamed(name, result.name);
      onOpenChange(false);
    } catch (err) {
      toast.error(t("renameFailed"), { description: err instanceof Error ? err.message : undefined });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("renameTitle")}</DialogTitle>
          <DialogDescription>{t("renameHint", { url: `${origin}/artifacts/${slug || "…"}` })}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <Label htmlFor="artifact-rename">{t("renameLabel")}</Label>
          <Input id="artifact-rename" value={value} onChange={(e) => setValue(e.target.value)} autoFocus autoComplete="off" spellCheck={false} />
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t("cancel")}
          </Button>
          <Button type="button" onClick={() => void save()} disabled={saving || !slug || unchanged}>
            {t("renameSave")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
