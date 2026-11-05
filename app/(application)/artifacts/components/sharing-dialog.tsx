"use client";

/**
 * Changes who can open an existing share and for how long. Loads the
 * settings from GET /shared-artifacts/:name/settings, edits them through
 * <SharingForm>, saves through PATCH.
 */

import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { sharedArtifactsApi, type ShareSettings } from "@/lib/api/shared-artifacts";
import { artifactType, displayFilename } from "@/lib/artifacts/artifact-type";

import { asRightsMode, EMPTY_RBAC, SharingForm, sharingPayload, type SharingValue } from "./sharing-form";

export interface SharingDialogProps {
  name: string | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

const unexpired = (iso: string | null | undefined): string | null => (iso && new Date(iso).getTime() > Date.now() ? iso : null);

export function SharingDialog({ name, onOpenChange, onSaved }: SharingDialogProps) {
  const t = useTranslations("artifacts");
  const [settings, setSettings] = React.useState<ShareSettings | null>(null);
  const [failed, setFailed] = React.useState(false);
  const [value, setValue] = React.useState<SharingValue>({ authMode: "regular", password: "", expiry: "never", rightsMode: "private", rbac: EMPTY_RBAC, agentSlots: [] });
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (name === null) return;
    let cancelled = false;
    setSettings(null);
    setFailed(false);
    sharedArtifactsApi
      .getSettings(name)
      .then((s) => {
        if (cancelled) return;
        setSettings(s);
        setValue({
          authMode: s.auth_mode,
          password: "",
          expiry: unexpired(s.expires_at) ? "keep" : "never",
          rightsMode: s.auth_mode === "regular" ? asRightsMode(s.rights_mode) : "private",
          rbac: s.rbac,
          // Shape-checked for the same reason page.tsx is: `AgentSlotsField`
          // calls `.some` on this, and an older backend could still answer
          // with the `{}` a raw-array write left in the jsonb column (see the
          // backend's `readAgentSlots`) — which would throw while rendering
          // the dialog, with no way back to a saveable state.
          agentSlots: Array.isArray(s.agent_slots) ? s.agent_slots : [],
        });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [name]);

  const hasPassword = settings?.auth_mode === "password";
  const needsPassword = value.authMode === "password" && !hasPassword && !value.password;
  const isApp = settings ? artifactType(displayFilename(settings.s3key), settings.content_type).kind === "app" : false;

  const save = async () => {
    if (!name || !settings) return;
    setSaving(true);
    try {
      await sharedArtifactsApi.update(name, sharingPayload(value));
      toast.success(t("sharingSaved"));
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(t("sharingFailed"), { description: err instanceof Error ? err.message : undefined });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={name !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("sharingTitle")}</DialogTitle>
          <DialogDescription>{t("sharingDescription", { name: name ?? "" })}</DialogDescription>
        </DialogHeader>

        {failed ? (
          <p className="text-sm text-destructive">{t("sharingLoadFailed")}</p>
        ) : !settings ? (
          <div className="space-y-3" aria-busy="true">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-2/3" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <SharingForm value={value} onChange={setValue} hasPassword={hasPassword} currentExpiry={unexpired(settings.expires_at)} initialRbac={settings.rbac} disabled={saving} isApp={isApp} />
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t("cancel")}
          </Button>
          <Button type="button" onClick={() => void save()} disabled={saving || !settings || needsPassword}>
            {t("sharingSave")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
