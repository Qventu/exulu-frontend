"use client";

/**
 * ItemsActionBar — sticky contextual action bar appearing when at least one
 * row is selected. Active view: Archive + Clear. Archived view: Unarchive
 * + Delete (destructive via ConfirmDialog) + Clear.
 *
 * Inventory items handled here: 19 (bulk archive), 20 (bulk unarchive),
 * 21 (bulk delete via ConfirmDialog).
 */

import { Archive, PackageOpen, Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { ConfirmDialog } from "@/components/primitives/confirm-dialog";
import { Button } from "@/components/ui/button";

export interface ItemsActionBarProps {
  archived: boolean;
  count: number;
  pending: boolean;
  onArchive: () => Promise<void> | void;
  onUnarchive: () => Promise<void> | void;
  onDelete: () => Promise<void> | void;
  onClear: () => void;
}

export function ItemsActionBar({
  archived,
  count,
  pending,
  onArchive,
  onUnarchive,
  onDelete,
  onClear,
}: ItemsActionBarProps) {
  const t = useTranslations("knowledge");
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  return (
    <>
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-md border bg-muted/50 p-2 backdrop-blur supports-[backdrop-filter]:bg-muted/40">
        <span className="px-2 text-sm font-medium">
          {t("workspace.items.action.selected", { count })}
        </span>
        {archived ? (
          <>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-11 md:h-9"
              disabled={pending}
              onClick={() => onUnarchive()}
            >
              <PackageOpen aria-hidden="true" className="mr-2 size-4" />
              {t("workspace.items.action.unarchive")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="h-11 md:h-9"
              disabled={pending}
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 aria-hidden="true" className="mr-2 size-4" />
              {t("workspace.items.action.delete")}
            </Button>
          </>
        ) : (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-11 md:h-9"
            disabled={pending}
            onClick={() => onArchive()}
          >
            <Archive aria-hidden="true" className="mr-2 size-4" />
            {t("workspace.items.action.archive")}
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="ml-auto size-11 md:size-9"
          onClick={onClear}
          aria-label={t("workspace.items.action.clearSelection")}
        >
          <X aria-hidden="true" className="size-4" />
        </Button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t("workspace.items.confirmDelete.title", { count })}
        description={t("workspace.items.confirmDelete.description", { count })}
        variant="destructive"
        confirmLabel={t("workspace.items.confirmDelete.confirm")}
        onConfirm={async () => {
          await onDelete();
        }}
      />
    </>
  );
}
