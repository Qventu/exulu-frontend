"use client";

/**
 * Column definitions for the Users tab DataTable (access.md §3 L1 + L1.5).
 *
 * - User column: email + StatusDot under it (verified/pending, semantic
 *   tokens — fixes U7) + Shield glyph for super admins, visible only to a
 *   super-admin viewer (#22 read-state).
 * - Role column: plain text + a quiet "Change" link that opens the panel
 *   (the inline-edit affordance lives in the panel). The shared RoleSelector
 *   widget stays the canonical picker — wrapped in the detail panel where the
 *   ConfirmDialog can render.
 * - Team column: same shape as Role.
 * - Updated column: RelativeTime (with absolute on hover/focus).
 * - Row OverflowMenu: Reset password / Delete user (also reachable from the
 *   detail panel).
 *
 * Sorting on the server-paginated columns stays OFF until
 * ACCESS_USER_SORT_SUPPORTED is flipped (U10 fix — headers must not lie).
 */

import type { ColumnDef } from "@tanstack/react-table";
import { Shield } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { OverflowMenu } from "@/components/primitives/overflow-menu";
import { RelativeTime } from "@/components/primitives/relative-time";
import { StatusDot } from "@/components/primitives/status-dot";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { User } from "@EXULU_SHARED/models/user";

import { ACCESS_USER_UPDATED_AT_SUPPORTED } from "../queries";
import { safeParseUserRow } from "./user-row-schema";

export type HideableUserColumnId = "role" | "team" | "updated";

export interface UserColumnsContext {
  viewerId: string | number | undefined;
  viewerIsSuperAdmin: boolean;
  onResetPassword: (user: User) => void;
  onDelete: (user: User) => void;
  /** Column ids the consumer (View menu) wants hidden. */
  hiddenColumns?: ReadonlySet<HideableUserColumnId>;
}

export function useUserColumns(ctx: UserColumnsContext): ColumnDef<User>[] {
  const t = useTranslations("access.users");
  const {
    viewerId,
    viewerIsSuperAdmin,
    onResetPassword,
    onDelete,
    hiddenColumns,
  } = ctx;

  return React.useMemo<ColumnDef<User>[]>(() => {
    const isHidden = (id: HideableUserColumnId) =>
      Boolean(hiddenColumns?.has(id));

    const columns: ColumnDef<User>[] = [
      {
        id: "user",
        header: t("columns.user"),
        cell: ({ row }) => {
          const user = row.original;
          const verified = Boolean(
            (user as User & { emailVerified?: unknown }).emailVerified,
          );
          const showShield =
            viewerIsSuperAdmin && Boolean(user.super_admin);
          return (
            <div className="flex min-w-0 items-center gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="max-w-[260px] truncate font-medium">
                    {user.email}
                  </span>
                  {showShield ? (
                    <TooltipProvider delayDuration={300}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Shield
                            aria-label={t("superAdmin.label")}
                            className="size-3.5 shrink-0 text-warning"
                          />
                        </TooltipTrigger>
                        <TooltipContent>
                          {t("superAdmin.label")}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : null}
                </div>
                <StatusDot
                  status={verified ? "success" : "warning"}
                  label={verified ? t("verified") : t("pending")}
                  className="mt-1 text-xs"
                />
              </div>
            </div>
          );
        },
      },
    ];

    if (!isHidden("role")) {
      columns.push({
        id: "role",
        header: t("columns.role"),
        cell: ({ row }) => (
          <span className="truncate text-sm">
            {row.original.role || (
              <span className="text-muted-foreground">{t("noRole")}</span>
            )}
          </span>
        ),
      });
    }

    if (!isHidden("team")) {
      columns.push({
        id: "team",
        header: t("columns.team"),
        cell: ({ row }) => (
          <span className="truncate text-sm">
            {row.original.team || (
              <span className="text-muted-foreground">{t("noTeam")}</span>
            )}
          </span>
        ),
      });
    }

    if (!isHidden("updated")) {
      columns.push({
        id: "updated",
        // Honest label: if the backend hasn't confirmed `updatedAt` on User
        // (ACCESS_USER_UPDATED_AT_SUPPORTED gate), the column header says
        // "Created" — no silent decay (audit-friendly attribution).
        header: ACCESS_USER_UPDATED_AT_SUPPORTED
          ? t("columns.updated")
          : t("columns.created"),
        cell: ({ row }) => {
          const original = row.original as User & {
            updatedAt?: string;
            createdAt?: string;
          };
          const value = ACCESS_USER_UPDATED_AT_SUPPORTED
            ? original.updatedAt ?? original.createdAt
            : original.createdAt;
          if (!value) return null;
          return (
            <RelativeTime
              date={value}
              className="text-sm text-muted-foreground"
            />
          );
        },
      });
    }

    columns.push({
      id: "actions",
      header: () => null,
      cell: ({ row }) => {
        const user = row.original;
        // Defense-in-depth row validation (ladder #27): a malformed payload
        // disables destructive actions instead of crashing them. Self-delete
        // is the bulk-path lockout's row-level twin (still blocked here).
        const parsed = safeParseUserRow(user);
        const isViewer =
          viewerId !== undefined && String(viewerId) === String(user.id);
        const disabled = isViewer || parsed === null;
        return (
          // Stop propagation so clicks on the row-actions menu (trigger and
          // any item) don't also fire the DataTable row.onClick (which opens
          // the user detail Sheet — would stack on top of e.g. the reset
          // password dialog launched from "Reset password").
          <div
            className="flex justify-end"
            onClick={(e) => e.stopPropagation()}
          >
            <OverflowMenu
              items={[
                {
                  label: t("rowActions.resetPassword"),
                  onSelect: () => onResetPassword(user),
                  disabled: parsed === null,
                },
                {
                  label: t("rowActions.delete"),
                  onSelect: () => onDelete(user),
                  destructive: true,
                  disabled,
                  description: isViewer
                    ? t("rowActions.selfDeleteBlocked")
                    : parsed === null
                      ? t("rowActions.invalidRow")
                      : undefined,
                },
              ]}
            />
          </div>
        );
      },
    });

    return columns;
  }, [t, viewerId, viewerIsSuperAdmin, onResetPassword, onDelete, hiddenColumns]);
}
