"use client";

/**
 * ManageFoldersDialog — the super-admin surface for the knowledge folders
 * (knowledge-folders design D7/D8).
 *
 * One row per folder (icon, name, description, sort order), each saved on
 * demand, plus a form for a new one. Deleting only drops the folder: its
 * contexts fall back to Ungrouped, which is what the confirmation says.
 *
 * Every write is awaited and the parent's hook refetches (no optimistic
 * state); a failure toasts and leaves the row's draft intact so the admin can
 * retry without retyping. Folder order in the list is the page's order
 * (`sortFolders`), so a changed sort order simply moves the row on the next
 * refetch.
 */

import { FolderPlus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import { ContextIcon } from "@/components/primitives/context-icon/context-icon";
import {
  ContextIconPicker,
  type ContextIconPickerLabels,
} from "@/components/primitives/context-icon/context-icon-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Folder } from "@/lib/knowledge/folders";

/** The editable half of a folder — what a row's draft and a create submit. */
interface FolderDraft {
  name: string;
  description: string;
  icon: string | null;
  /** Kept as typed so the field can be emptied; parsed on submit. */
  sortOrder: string;
}

/** Copy both forms hand down: the icon picker's, plus the field labels. */
type FolderFieldLabels = ContextIconPickerLabels & {
  name: string;
  namePlaceholder: string;
  description: string;
  descriptionPlaceholder: string;
  sortOrder: string;
};

/** One place for the copy the editor rows and the create form both need. */
function useFolderFieldLabels(): FolderFieldLabels {
  const t = useTranslations("knowledge");
  return {
    title: t("library.iconPicker.title"),
    searchPlaceholder: t("library.iconPicker.searchPlaceholder"),
    reset: t("library.iconPicker.reset"),
    noResults: t("library.iconPicker.noResults"),
    name: t("library.folders.name"),
    namePlaceholder: t("library.folders.namePlaceholder"),
    description: t("library.folders.description"),
    descriptionPlaceholder: t("library.folders.descriptionPlaceholder"),
    sortOrder: t("library.folders.sortOrder"),
  };
}

export interface ManageFoldersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Folders in display order (the page hands over `useContextFolders`). */
  folders: Folder[];
  onCreate: (input: {
    name: string;
    description?: string;
    icon?: string | null;
    sort_order?: number;
  }) => Promise<void>;
  onUpdate: (
    id: string,
    input: Partial<{
      name: string;
      description: string;
      icon: string | null;
      sort_order: number;
    }>,
  ) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

/** Trimmed name + parsed sort order; `null` when the name is empty. */
function toInput(draft: FolderDraft): {
  name: string;
  description: string;
  icon: string | null;
  sort_order: number;
} | null {
  const name = draft.name.trim();
  if (!name) return null;
  const sortOrder = Number(draft.sortOrder);
  return {
    name,
    description: draft.description.trim(),
    icon: draft.icon,
    sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
  };
}

/** Shared layout for one folder's icon tile and its three fields. */
function FolderFields({
  draft,
  onChange,
  iconLabel,
  labels,
  idPrefix,
}: {
  draft: FolderDraft;
  onChange: (next: FolderDraft) => void;
  /** Accessible name of the icon-picker trigger (the glyph is the only text). */
  iconLabel: string;
  labels: FolderFieldLabels;
  /** Unique per form, so every field's visible label is wired to its input. */
  idPrefix: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <ContextIconPicker
          value={draft.icon}
          onSelect={(icon) => onChange({ ...draft, icon })}
          labels={labels}
        >
          <button
            type="button"
            aria-label={iconLabel}
            className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted/60 p-2 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ContextIcon name={draft.icon} className="size-full" />
          </button>
        </ContextIconPicker>

        <div className="min-w-32 flex-1 space-y-1">
          <Label
            htmlFor={`${idPrefix}-name`}
            className="text-xs text-muted-foreground"
          >
            {labels.name}
          </Label>
          <Input
            id={`${idPrefix}-name`}
            value={draft.name}
            onChange={(event) =>
              onChange({ ...draft, name: event.target.value })
            }
            placeholder={labels.namePlaceholder}
          />
        </div>

        <div className="w-20 space-y-1">
          <Label
            htmlFor={`${idPrefix}-sort`}
            className="text-xs text-muted-foreground"
          >
            {labels.sortOrder}
          </Label>
          <Input
            id={`${idPrefix}-sort`}
            type="number"
            inputMode="numeric"
            value={draft.sortOrder}
            onChange={(event) =>
              onChange({ ...draft, sortOrder: event.target.value })
            }
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label
          htmlFor={`${idPrefix}-description`}
          className="text-xs text-muted-foreground"
        >
          {labels.description}
        </Label>
        <Input
          id={`${idPrefix}-description`}
          value={draft.description}
          onChange={(event) =>
            onChange({ ...draft, description: event.target.value })
          }
          placeholder={labels.descriptionPlaceholder}
        />
      </div>
    </div>
  );
}

/**
 * One existing folder: a draft seeded from the server row, saved explicitly.
 *
 * The draft deliberately survives a refetch (the row is keyed by folder id):
 * a save that landed leaves the draft equal to the server state anyway, and a
 * save that failed must not throw away what the admin typed.
 */
function FolderEditorRow({
  folder,
  onUpdate,
  onDelete,
}: {
  folder: Folder;
  onUpdate: ManageFoldersDialogProps["onUpdate"];
  onDelete: ManageFoldersDialogProps["onDelete"];
}) {
  const t = useTranslations("knowledge");
  const labels = useFolderFieldLabels();

  const [draft, setDraft] = React.useState<FolderDraft>({
    name: folder.name,
    description: folder.description ?? "",
    icon: folder.icon ?? null,
    sortOrder: String(folder.sort_order ?? 0),
  });
  const [confirmingDelete, setConfirmingDelete] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const input = toInput(draft);
  const dirty =
    input !== null &&
    (input.name !== folder.name ||
      input.description !== (folder.description ?? "") ||
      input.icon !== (folder.icon ?? null) ||
      input.sort_order !== (folder.sort_order ?? 0));

  const save = async () => {
    if (!input) return;
    setBusy(true);
    try {
      await onUpdate(folder.id, input);
    } catch {
      toast.error(t("library.folders.saveError"));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await onDelete(folder.id);
      setConfirmingDelete(false);
    } catch {
      toast.error(t("library.folders.deleteError"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="space-y-2 p-3">
      <FolderFields
        draft={draft}
        onChange={setDraft}
        idPrefix={`folder-${folder.id}`}
        iconLabel={t("library.folders.setIcon", { name: folder.name })}
        labels={labels}
      />

      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className="mr-auto text-xs text-muted-foreground">
          {t("library.folders.count", { count: folder.context_ids.length })}
        </span>
        {confirmingDelete ? (
          <>
            <span className="text-xs text-muted-foreground">
              {t("library.folders.deleteConfirm")}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => setConfirmingDelete(false)}
            >
              {t("library.folders.cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={busy}
              onClick={remove}
            >
              {t("library.folders.delete")}
            </Button>
          </>
        ) : (
          <>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => setConfirmingDelete(true)}
            >
              <Trash2 aria-hidden="true" className="mr-1.5 size-3.5" />
              {t("library.folders.delete")}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!dirty || busy}
              onClick={save}
            >
              {t("library.folders.save")}
            </Button>
          </>
        )}
      </div>
    </li>
  );
}

const EMPTY_DRAFT: FolderDraft = {
  name: "",
  description: "",
  icon: null,
  sortOrder: "0",
};

/** The create form: same fields, cleared once the folder exists. */
function NewFolderForm({
  onCreate,
}: {
  onCreate: ManageFoldersDialogProps["onCreate"];
}) {
  const t = useTranslations("knowledge");
  const labels = useFolderFieldLabels();

  const [draft, setDraft] = React.useState<FolderDraft>(EMPTY_DRAFT);
  const [busy, setBusy] = React.useState(false);

  const input = toInput(draft);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!input) return;
    setBusy(true);
    try {
      await onCreate(input);
      setDraft(EMPTY_DRAFT);
    } catch {
      toast.error(t("library.folders.createError"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      aria-label={t("library.folders.newTitle")}
      className="space-y-3 rounded-md border border-dashed p-3"
    >
      <p className="text-sm font-medium text-foreground">
        {t("library.folders.newTitle")}
      </p>

      <FolderFields
        draft={draft}
        onChange={setDraft}
        idPrefix="new-folder"
        iconLabel={t("library.folders.newIcon")}
        labels={labels}
      />

      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={!input || busy}>
          <FolderPlus aria-hidden="true" className="mr-1.5 size-4" />
          {t("library.folders.create")}
        </Button>
      </div>
    </form>
  );
}

export function ManageFoldersDialog({
  open,
  onOpenChange,
  folders,
  onCreate,
  onUpdate,
  onDelete,
}: ManageFoldersDialogProps) {
  const t = useTranslations("knowledge");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("library.folders.manageTitle")}</DialogTitle>
          <DialogDescription>
            {t("library.folders.manageDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {folders.length === 0 ? (
            <p className="rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
              {t("library.folders.empty")}
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-md border">
              {folders.map((folder) => (
                <FolderEditorRow
                  key={folder.id}
                  folder={folder}
                  onUpdate={onUpdate}
                  onDelete={onDelete}
                />
              ))}
            </ul>
          )}

          <NewFolderForm onCreate={onCreate} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
