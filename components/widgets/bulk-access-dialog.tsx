"use client";

/**
 * BulkAccessDialog — overwrites the RBAC configuration of the currently
 * selected items in one call. Because this is overwrite semantics, the
 * embedded RBACControl opens at a neutral default (Private, no grants)
 * rather than reading any single item's config. modalMode keeps the
 * "view all users" popover inline (this is already inside a Dialog).
 *
 * Promoted from `app/(application)/data/[ctx]/components/` (codebase-structure
 * §1.2 — a second feature consumer, `transcriptions`, triggered the promotion
 * rule). `components/widgets` may not import `@/app/*` (eslint.config.mjs
 * `exulu/tier-widgets`), so the context-scoped `BULK_UPDATE_ITEM_RBAC(context)`
 * mutation document is no longer built in here — each feature builds its own
 * (same-context) document and passes it in via `mutation`.
 */

import { useMutation, type DocumentNode } from "@apollo/client";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import { RBACControl } from "@/components/rbac";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Mode = "private" | "users" | "roles" | "teams" | "public";
type Grant<Id> = { id: Id; rights: "read" | "write" };

export interface BulkAccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The context's `itemsBulkUpdateRBAC` mutation document — e.g.
   *  `BULK_UPDATE_ITEM_RBAC(context.id)` from `app/(application)/data/queries.ts`,
   *  or a feature-colocated equivalent for the same operation shape. */
  mutation: DocumentNode;
  ids: string[];
  onApplied: () => void;
}

export function BulkAccessDialog({
  open,
  onOpenChange,
  mutation,
  ids,
  onApplied,
}: BulkAccessDialogProps) {
  const t = useTranslations("knowledge");

  const [rightsMode, setRightsMode] = React.useState<Mode>("private");
  const [users, setUsers] = React.useState<Grant<number>[]>([]);
  const [roles, setRoles] = React.useState<Grant<string>[]>([]);
  const [teams, setTeams] = React.useState<Grant<string>[]>([]);

  // Reset to a neutral default each time the dialog opens.
  React.useEffect(() => {
    if (open) {
      setRightsMode("private");
      setUsers([]);
      setRoles([]);
      setTeams([]);
    }
  }, [open]);

  const [bulkUpdateRbac, { loading }] = useMutation(
    mutation,
    {
      onCompleted: () => {
        toast.success(
          t("workspace.bulk.setAccess.success", { count: ids.length }),
        );
        onApplied();
        onOpenChange(false);
      },
      onError: (e) =>
        toast.error(t("workspace.bulk.setAccess.error"), {
          description: e.message,
        }),
    },
  );

  const handleApply = async () => {
    await bulkUpdateRbac({
      variables: {
        ids,
        rights_mode: rightsMode,
        rbac: { users, roles, teams },
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85dvh] max-w-lg flex-col gap-4">
        <DialogHeader>
          <DialogTitle>{t("workspace.bulk.setAccess.title")}</DialogTitle>
          <DialogDescription>
            {t("workspace.bulk.setAccess.description", { count: ids.length })}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <RBACControl
            modalMode
            subjectLabel={t("workspace.access.subjectLabel")}
            initialRightsMode={rightsMode}
            initialUsers={users}
            initialRoles={roles}
            initialTeams={teams}
            onChange={(mode, nextUsers, nextRoles, nextTeams) => {
              setRightsMode(mode as Mode);
              setUsers(nextUsers);
              setRoles(nextRoles);
              setTeams(nextTeams ?? []);
            }}
          />
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {t("workspace.bulk.cancel")}
          </Button>
          <Button type="button" onClick={handleApply} disabled={loading}>
            {t("workspace.bulk.setAccess.apply")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
