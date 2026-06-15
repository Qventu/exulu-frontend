"use client";

/**
 * SuperAdminToggle — the Danger-zone super-admin grant/revoke control
 * (access.md ladder #22/#23). Refactored from the legacy column cell:
 *
 * - Replaces the ad-hoc Dialog with the shared ConfirmDialog primitive (U2).
 * - Replaces hardcoded amber/red classes with semantic warning/destructive
 *   tokens (U8). The Switch uses Radix's default destructive-state styling
 *   through the consumer's variant (no hardcoded bg-red-500 anymore).
 * - Self-demotion still blocked inline with a clear toast.
 * - Lives logically inside user-detail-panel's Danger zone but stays its own
 *   file for testability.
 */

import { AlertTriangle, ShieldAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/primitives/confirm-dialog";
import { Switch } from "@/components/ui/switch";

export interface SuperAdminToggleProps {
  user: {
    id: string | number;
    email: string;
    super_admin?: boolean;
  };
  /** Viewer id — self-demotion is blocked inline. */
  viewerId: string | number | undefined;
  /** Mutation callback; returns a promise that resolves when the change is committed. */
  onChange: (next: boolean) => Promise<unknown>;
}

export function SuperAdminToggle({
  user,
  viewerId,
  onChange,
}: SuperAdminToggleProps) {
  const t = useTranslations("access.users.superAdmin");
  const [pendingChange, setPendingChange] = React.useState<boolean | null>(null);

  const isSuperAdmin = Boolean(user.super_admin);
  const isViewer = viewerId !== undefined && String(viewerId) === String(user.id);

  const handleToggleChange = (checked: boolean) => {
    if (isViewer && isSuperAdmin && !checked) {
      toast.error(t("selfBlockedTitle"), {
        description: t("selfBlockedDescription"),
      });
      return;
    }
    setPendingChange(checked);
  };

  const granting = pendingChange === true;
  const revoking = pendingChange === false;

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <ShieldAlert
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 text-warning"
          />
          <div className="min-w-0">
            <p className="text-sm font-medium">{t("label")}</p>
            <p className="text-xs text-muted-foreground">
              {isSuperAdmin ? t("captionOn") : t("captionOff")}
            </p>
          </div>
        </div>
        <Switch
          checked={isSuperAdmin}
          onCheckedChange={handleToggleChange}
          aria-label={t("label")}
        />
      </div>

      <ConfirmDialog
        open={pendingChange !== null}
        onOpenChange={(next) => {
          if (!next) setPendingChange(null);
        }}
        variant="destructive"
        title={granting ? t("grantTitle") : t("revokeTitle")}
        description={
          granting
            ? t("grantDescription", { email: user.email })
            : t("revokeDescription", { email: user.email })
        }
        confirmLabel={granting ? t("grantConfirm") : t("revokeConfirm")}
        warning={
          revoking ? (
            <span className="flex items-start gap-2">
              <AlertTriangle
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0"
              />
              <span>{t("lastAdminWarning")}</span>
            </span>
          ) : undefined
        }
        onConfirm={async () => {
          if (pendingChange === null) return;
          try {
            await onChange(pendingChange);
            toast.success(
              pendingChange ? t("grantedTitle") : t("revokedTitle"),
              {
                description: pendingChange
                  ? t("grantedDescription", { email: user.email })
                  : t("revokedDescription", { email: user.email }),
              },
            );
          } catch (error) {
            toast.error(t("failedTitle"), {
              description:
                error instanceof Error ? error.message : t("failedDescription"),
            });
            throw error;
          }
        }}
      />
    </>
  );
}
