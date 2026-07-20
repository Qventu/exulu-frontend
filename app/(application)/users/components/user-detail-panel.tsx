"use client";

/**
 * User detail panel (L2/L3/L4) — access.md §3 "User detail panel":
 *  - Identity: email + id CopyFields, created + last-used RelativeTime,
 *    StatusDot verified/pending.
 *  - Access: Role + Team via shared widgets, each mutation gated by
 *    ConfirmDialog with blast-radius copy (replaces window.confirm — U2/U6).
 *  - Actions: Reset password (extracted dialog).
 *  - Danger zone: SuperAdminToggle + Delete user (ConfirmDialog destructive,
 *    post-resolution toast — U4; self-delete blocked inline).
 *  - L4 "Raw" toggle exposing the fetched GraphQL row as masked JSON for
 *    P4-grade debugging (secrets masked, never raw).
 *
 * All mutations here are per-action ConfirmDialogs (atomic). No draft-state,
 * so no SaveBar — that's reserved for the role/team forms.
 */

import { Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/primitives/confirm-dialog";
import { CopyField } from "@/components/primitives/copy-field";
import { FormSection } from "@/components/primitives/form-section";
import { RelativeTime } from "@/components/primitives/relative-time";
import { StatusDot } from "@/components/primitives/status-dot";
import { Button } from "@/components/ui/button";
import { RoleSelector } from "@/components/widgets/role-selector";
import { TeamSelector } from "@/components/widgets/team-selector";
import type { User } from "@EXULU_SHARED/models/user";

import { useUpdateUser } from "../hooks";
import { ResetPasswordDialog } from "./reset-password-dialog";
import { SuperAdminToggle } from "./super-admin-toggle";

export interface UserDetailPanelProps {
  user: User;
  viewerId: string | number | undefined;
  viewerIsSuperAdmin: boolean;
  onDelete: (id: string | number) => Promise<unknown>;
  /** Called after a successful delete so the parent can clear selection. */
  onDeleted: () => void;
}

/**
 * Mask any field that smells like a secret before rendering the raw JSON
 * toggle (L4). Belt-and-suspenders: secret columns are no longer in the
 * GET_USERS selection, but the mask is kept as a safety net in case any
 * field appears in future selections or local state.
 */
const SECRET_KEYS = new Set(["anthropic_token", "password", "apikey"]);

function maskUserForRaw(user: User): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(user)) {
    if (SECRET_KEYS.has(key)) {
      out[key] = value ? "•••• (present)" : null;
    } else {
      out[key] = value;
    }
  }
  return out;
}

export function UserDetailPanel({
  user,
  viewerId,
  viewerIsSuperAdmin,
  onDelete,
  onDeleted,
}: UserDetailPanelProps) {
  const t = useTranslations("access.users.detail");
  const tConfirm = useTranslations("access.users");
  const locale = useLocale();
  const updateUser = useUpdateUser();

  const [pendingRoleId, setPendingRoleId] = React.useState<string | null>(null);
  const [pendingTeamId, setPendingTeamId] = React.useState<string | null>(null);
  const [resetOpen, setResetOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [showRaw, setShowRaw] = React.useState(false);

  const timestampFormatter = React.useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    [locale],
  );

  const isViewer =
    viewerId !== undefined && String(viewerId) === String(user.id);
  const verified = Boolean((user as User & { emailVerified?: unknown }).emailVerified);
  const created = (user as User & { createdAt?: string }).createdAt;
  const lastUsed = (user as User & { last_used?: string | null }).last_used;

  return (
    <div className="flex flex-col gap-6 p-4">
      {/* Identity */}
      <FormSection title={t("identity")}>
        <CopyField value={user.email} label={t("email")} mono={false} />
        <CopyField value={String(user.id)} label={t("userId")} />
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">{t("status")}</span>
          <StatusDot
            status={verified ? "success" : "warning"}
            label={verified ? t("verified") : t("pending")}
          />
        </div>
        <dl className="flex flex-col gap-2 text-sm">
          {created ? (
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-muted-foreground">{t("created")}</dt>
              <dd>
                <RelativeTime date={created} />
              </dd>
            </div>
          ) : null}
          <div className="flex items-baseline justify-between gap-2">
            <dt className="text-muted-foreground">{t("lastUsed")}</dt>
            <dd>
              {lastUsed ? (
                <RelativeTime date={lastUsed} />
              ) : (
                <span className="text-muted-foreground">{t("never")}</span>
              )}
            </dd>
          </div>
        </dl>
      </FormSection>

      {/* Access */}
      <FormSection title={t("access")} description={t("accessDescription")}>
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            {t("role")}
          </p>
          <RoleSelector
            value={user.role ?? ""}
            onChange={(roleId) => {
              if (roleId && roleId !== user.role) setPendingRoleId(roleId);
            }}
          />
        </div>
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            {t("team")}
          </p>
          <TeamSelector
            value={user.team ?? ""}
            onChange={(teamId) => {
              if (teamId && teamId !== user.team) setPendingTeamId(teamId);
            }}
          />
        </div>
      </FormSection>

      {/* Actions */}
      <FormSection title={t("actions")}>
        <Button
          type="button"
          variant="outline"
          onClick={() => setResetOpen(true)}
          className="w-full justify-center"
        >
          {t("resetPassword")}
        </Button>
      </FormSection>

      {/* Danger zone (destructive-framed section per §3 "User detail panel"). */}
      <section
        aria-labelledby="user-danger-title"
        className="flex flex-col gap-3 rounded-md border border-destructive/20 bg-destructive/[0.02] p-4"
      >
        <h2
          id="user-danger-title"
          className="text-base font-medium text-destructive"
        >
          {t("dangerZone")}
        </h2>
        {viewerIsSuperAdmin ? (
          <SuperAdminToggle
            user={{
              id: user.id,
              email: user.email,
              super_admin: user.super_admin,
            }}
            viewerId={viewerId}
            onChange={(next) =>
              updateUser({ id: user.id, super_admin: next })
            }
          />
        ) : null}
        <Button
          type="button"
          variant="outline"
          onClick={() => setDeleteOpen(true)}
          disabled={isViewer}
          className="w-full justify-center text-destructive hover:bg-destructive/10 hover:text-destructive"
          title={isViewer ? t("selfDeleteBlocked") : undefined}
        >
          <Trash2 aria-hidden="true" className="mr-2 size-4" />
          {t("deleteUser")}
        </Button>
        {isViewer ? (
          <p className="text-xs text-muted-foreground">
            {t("selfDeleteBlocked")}
          </p>
        ) : null}
      </section>

      {/* L4 — Raw row for P4 debugging (secrets masked) */}
      <FormSection
        title={t("raw")}
        description={t("rawDescription")}
        collapsible
        defaultOpen={false}
      >
        <button
          type="button"
          onClick={() => setShowRaw((v) => !v)}
          className="self-start text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          {showRaw ? t("rawHide") : t("rawShow")}
        </button>
        {showRaw ? (
          <pre className="max-h-64 overflow-auto rounded-md border bg-muted px-3 py-2 font-mono text-xs">
            {JSON.stringify(maskUserForRaw(user), null, 2)}
          </pre>
        ) : null}
      </FormSection>

      {/* Role-change confirmation (replaces window.confirm — U2) */}
      <ConfirmDialog
        open={pendingRoleId !== null}
        onOpenChange={(next) => {
          if (!next) setPendingRoleId(null);
        }}
        variant="default"
        title={tConfirm("confirmRoleChangeTitle")}
        description={tConfirm("confirmRoleChangeDescription", {
          email: user.email,
        })}
        confirmLabel={tConfirm("confirmRoleChangeConfirm")}
        onConfirm={async () => {
          if (!pendingRoleId) return;
          try {
            await updateUser({ id: user.id, role: pendingRoleId });
            toast.success(tConfirm("roleChangedTitle"));
          } catch (error) {
            toast.error(tConfirm("roleChangeFailedTitle"), {
              description:
                error instanceof Error ? error.message : undefined,
            });
            throw error;
          }
        }}
      />

      {/* Team-change confirmation (replaces window.confirm — U2) */}
      <ConfirmDialog
        open={pendingTeamId !== null}
        onOpenChange={(next) => {
          if (!next) setPendingTeamId(null);
        }}
        variant="default"
        title={tConfirm("confirmTeamChangeTitle")}
        description={tConfirm("confirmTeamChangeDescription", {
          email: user.email,
        })}
        confirmLabel={tConfirm("confirmTeamChangeConfirm")}
        onConfirm={async () => {
          if (!pendingTeamId) return;
          try {
            await updateUser({ id: user.id, team: pendingTeamId });
            toast.success(tConfirm("teamChangedTitle"));
          } catch (error) {
            toast.error(tConfirm("teamChangeFailedTitle"), {
              description:
                error instanceof Error ? error.message : undefined,
            });
            throw error;
          }
        }}
      />

      {/* Reset password */}
      <ResetPasswordDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        user={{ id: user.id, email: user.email }}
      />

      {/* Delete user */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        variant="destructive"
        title={tConfirm("confirmDeleteTitle")}
        description={tConfirm("confirmDeleteDescription", {
          email: user.email,
        })}
        confirmLabel={tConfirm("confirmDeleteConfirm")}
        onConfirm={async () => {
          try {
            await onDelete(user.id);
            toast.success(tConfirm("deletedTitle"), {
              description: tConfirm("deletedDescription", { email: user.email }),
            });
            onDeleted();
          } catch (error) {
            toast.error(tConfirm("deleteFailedTitle"), {
              description:
                error instanceof Error ? error.message : undefined,
            });
            throw error;
          }
        }}
      />

      <span className="hidden">
        {/* Reserved for future "X by viewer Y" attribution */}
        {timestampFormatter.format(new Date())}
      </span>
    </div>
  );
}
