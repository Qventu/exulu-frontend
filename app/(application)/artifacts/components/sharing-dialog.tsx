"use client";

import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import { RBACControl } from "@/components/rbac";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { sharedArtifactsApi, type ShareAuthMode, type ShareRbac, type ShareSettings } from "@/lib/api/shared-artifacts";

export interface SharingDialogProps {
  name: string | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

type Expiry = "keep" | 1 | 7 | 30 | "never";
type RightsMode = "private" | "users" | "roles" | "teams" | "public";

const RIGHTS_MODES: RightsMode[] = ["private", "users", "roles", "teams", "public"];

const asRightsMode = (value: string | null | undefined): RightsMode =>
  RIGHTS_MODES.includes(value as RightsMode) ? (value as RightsMode) : "private";

const expiryToIso = (choice: Expiry, current: string | null): string | null | undefined => {
  if (choice === "keep") return undefined;
  if (choice === "never") return null;
  return new Date(Date.now() + choice * 86_400_000).toISOString();
};

/**
 * Changes who can open a share and for how long: access mode (public,
 * password, logged-in users), the password, the expiry, and — for logged-in
 * access — the rights scope through the same RBACControl the share dialog
 * uses when a link is created.
 */
export function SharingDialog({ name, onOpenChange, onSaved }: SharingDialogProps) {
  const t = useTranslations("artifacts");
  const [settings, setSettings] = React.useState<ShareSettings | null>(null);
  const [failed, setFailed] = React.useState(false);
  const [authMode, setAuthMode] = React.useState<ShareAuthMode>("regular");
  const [password, setPassword] = React.useState("");
  const [expiry, setExpiry] = React.useState<Expiry>("keep");
  const [rightsMode, setRightsMode] = React.useState<RightsMode>("private");
  const [rbac, setRbac] = React.useState<ShareRbac>({ users: [], roles: [], teams: [] });
  const [saving, setSaving] = React.useState(false);
  const open = name !== null;

  React.useEffect(() => {
    if (name === null) return;
    let cancelled = false;
    setSettings(null);
    setFailed(false);
    setPassword("");
    sharedArtifactsApi
      .getSettings(name)
      .then((s) => {
        if (cancelled) return;
        setSettings(s);
        setAuthMode(s.auth_mode);
        setExpiry(s.expires_at && new Date(s.expires_at).getTime() > Date.now() ? "keep" : "never");
        setRightsMode(s.auth_mode === "regular" ? asRightsMode(s.rights_mode) : "private");
        setRbac(s.rbac);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [name]);

  const hasPassword = settings?.auth_mode === "password";
  const needsPassword = authMode === "password" && !hasPassword && !password;
  const currentExpiry = settings?.expires_at && new Date(settings.expires_at).getTime() > Date.now() ? settings.expires_at : null;
  const expiryOptions: Array<{ id: Expiry; label: string }> = [
    ...(currentExpiry ? [{ id: "keep" as Expiry, label: t("expiryKeep", { date: new Date(currentExpiry).toLocaleDateString() }) }] : []),
    { id: 1, label: t("expiry1d") },
    { id: 7, label: t("expiry7d") },
    { id: 30, label: t("expiry30d") },
    { id: "never", label: t("expiryNever") },
  ];

  const save = async () => {
    if (!name || !settings) return;
    setSaving(true);
    try {
      const expires = expiryToIso(expiry, settings.expires_at);
      await sharedArtifactsApi.update(name, {
        auth_mode: authMode,
        ...(expires !== undefined ? { expires_at: expires } : {}),
        ...(authMode === "password" && password ? { password } : {}),
        ...(authMode === "regular" ? { rights_mode: rightsMode, rbac } : {}),
      });
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
    <Dialog open={open} onOpenChange={onOpenChange}>
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
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t("accessLabel")}</Label>
              <div className="flex flex-wrap gap-2">
                {(["public", "password", "regular"] as ShareAuthMode[]).map((m) => (
                  <Button key={m} type="button" size="sm" variant={authMode === m ? "default" : "outline"} aria-pressed={authMode === m} onClick={() => setAuthMode(m)}>
                    {m === "public" ? t("accessPublicOption") : m === "password" ? t("accessPasswordOption") : t("accessLoginOption")}
                  </Button>
                ))}
              </div>
            </div>

            {authMode === "password" && (
              <div className="space-y-1.5">
                <Label htmlFor="artifact-share-pw">{t("passwordLabel")}</Label>
                <Input id="artifact-share-pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
                {hasPassword && <p className="text-xs text-muted-foreground">{t("passwordKeepHint")}</p>}
              </div>
            )}

            <div className="space-y-1.5">
              <Label>{t("expiresLabel")}</Label>
              <div className="flex flex-wrap gap-2">
                {expiryOptions.map((o) => (
                  <Button key={String(o.id)} type="button" size="sm" variant={expiry === o.id ? "default" : "outline"} aria-pressed={expiry === o.id} onClick={() => setExpiry(o.id)}>
                    {o.label}
                  </Button>
                ))}
              </div>
            </div>

            {authMode === "regular" && (
              <div className="space-y-1.5">
                <Label>{t("whoLabel")}</Label>
                <RBACControl
                  allowedModes={RIGHTS_MODES}
                  initialRightsMode={rightsMode}
                  initialUsers={settings.rbac.users}
                  initialRoles={settings.rbac.roles}
                  initialTeams={settings.rbac.teams}
                  modalMode={true}
                  subjectLabel="artifact"
                  onChange={(mode, users, roles, teams) => {
                    setRightsMode(asRightsMode(mode));
                    setRbac({ users, roles, teams });
                  }}
                />
              </div>
            )}
          </div>
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
