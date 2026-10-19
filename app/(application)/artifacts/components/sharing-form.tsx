"use client";

/**
 * The sharing settings of an artifact as one controlled form: access mode
 * (public, password, logged-in users), the password, the expiry, and for
 * logged-in access the rights scope through RBACControl. Used by the
 * "Sharing…" dialog of an existing share and by the "New artifact" dialog.
 */

import { useTranslations } from "next-intl";
import * as React from "react";

import { RBACControl } from "@/components/rbac";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ShareAuthMode, ShareRbac } from "@/lib/api/shared-artifacts";

export type Expiry = "keep" | 1 | 7 | 30 | "never";
export type RightsMode = "private" | "users" | "roles" | "teams" | "public";

export const RIGHTS_MODES: RightsMode[] = ["private", "users", "roles", "teams", "public"];

export const asRightsMode = (value: string | null | undefined): RightsMode =>
  RIGHTS_MODES.includes(value as RightsMode) ? (value as RightsMode) : "private";

/** The ISO expiry for a choice; `undefined` = leave the stored value alone. */
export const expiryToIso = (choice: Expiry): string | null | undefined => {
  if (choice === "keep") return undefined;
  if (choice === "never") return null;
  return new Date(Date.now() + choice * 86_400_000).toISOString();
};

export interface SharingValue {
  authMode: ShareAuthMode;
  password: string;
  expiry: Expiry;
  rightsMode: RightsMode;
  rbac: ShareRbac;
}

export const EMPTY_RBAC: ShareRbac = { users: [], roles: [], teams: [] };

export interface SharingFormProps {
  value: SharingValue;
  onChange: (next: SharingValue) => void;
  /** The share already has a password: an empty field keeps it. */
  hasPassword?: boolean;
  /** A current, unexpired expiry that may be kept as it is. */
  currentExpiry?: string | null;
  /** The stored rbac scope the RBACControl starts from. */
  initialRbac?: ShareRbac;
  disabled?: boolean;
}

export function SharingForm({ value, onChange, hasPassword = false, currentExpiry = null, initialRbac = EMPTY_RBAC, disabled = false }: SharingFormProps) {
  const t = useTranslations("artifacts");
  const set = (patch: Partial<SharingValue>) => onChange({ ...value, ...patch });

  const expiryOptions: Array<{ id: Expiry; label: string }> = [
    ...(currentExpiry ? [{ id: "keep" as Expiry, label: t("expiryKeep", { date: new Date(currentExpiry).toLocaleDateString() }) }] : []),
    { id: 1, label: t("expiry1d") },
    { id: 7, label: t("expiry7d") },
    { id: 30, label: t("expiry30d") },
    { id: "never", label: t("expiryNever") },
  ];

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>{t("accessLabel")}</Label>
        <div className="flex flex-wrap gap-2">
          {(["public", "password", "regular"] as ShareAuthMode[]).map((m) => (
            <Button key={m} type="button" size="sm" variant={value.authMode === m ? "default" : "outline"} aria-pressed={value.authMode === m} disabled={disabled} onClick={() => set({ authMode: m })}>
              {m === "public" ? t("accessPublicOption") : m === "password" ? t("accessPasswordOption") : t("accessLoginOption")}
            </Button>
          ))}
        </div>
      </div>

      {value.authMode === "password" && (
        <div className="space-y-1.5">
          <Label htmlFor="artifact-share-pw">{t("passwordLabel")}</Label>
          <Input id="artifact-share-pw" type="password" value={value.password} onChange={(e) => set({ password: e.target.value })} autoComplete="new-password" disabled={disabled} />
          {hasPassword && <p className="text-xs text-muted-foreground">{t("passwordKeepHint")}</p>}
        </div>
      )}

      <div className="space-y-1.5">
        <Label>{t("expiresLabel")}</Label>
        <div className="flex flex-wrap gap-2">
          {expiryOptions.map((o) => (
            <Button key={String(o.id)} type="button" size="sm" variant={value.expiry === o.id ? "default" : "outline"} aria-pressed={value.expiry === o.id} disabled={disabled} onClick={() => set({ expiry: o.id })}>
              {o.label}
            </Button>
          ))}
        </div>
      </div>

      {value.authMode === "regular" && (
        <div className="space-y-1.5">
          <Label>{t("whoLabel")}</Label>
          <RBACControl
            allowedModes={RIGHTS_MODES}
            initialRightsMode={value.rightsMode}
            initialUsers={initialRbac.users}
            initialRoles={initialRbac.roles}
            initialTeams={initialRbac.teams}
            modalMode={true}
            subjectLabel="artifact"
            onChange={(mode, users, roles, teams) => set({ rightsMode: asRightsMode(mode), rbac: { users, roles, teams } })}
          />
        </div>
      )}
    </div>
  );
}

/** The share-API fields for a sharing value; `expires_at` is omitted for "keep". */
export function sharingPayload(value: SharingValue) {
  const expires = expiryToIso(value.expiry);
  return {
    auth_mode: value.authMode,
    ...(expires !== undefined ? { expires_at: expires } : {}),
    ...(value.authMode === "password" && value.password ? { password: value.password } : {}),
    ...(value.authMode === "regular" ? { rights_mode: value.rightsMode, rbac: value.rbac } : {}),
  };
}
